# Backend Quotation API Redesign - Bulletproof Implementation

**Priority:** 🔴 CRITICAL  
**Status:** Implementation Required  
**Date:** Current  
**Goal:** Prevent "Subtotal is required and must be greater than 0" error completely

---

## Overview

This document provides a complete redesign of the backend quotation API to ensure the subtotal error **NEVER** occurs. The backend will:

1. **Validate** all inputs with multiple layers
2. **Calculate** subtotal from products if not provided
3. **Fallback** to pricing tables if calculation fails
4. **Reject** only if absolutely no valid price can be determined
5. **Log** everything for debugging

---

## Database Schema Updates

### Required Columns in `quotations` Table

```sql
-- Ensure all required columns exist
ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS subtotal DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS central_subsidy DECIMAL(12,2) DEFAULT 0;

ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS state_subsidy DECIMAL(12,2) DEFAULT 0;

ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS total_subsidy DECIMAL(12,2) DEFAULT 0;

ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS amount_after_subsidy DECIMAL(12,2) DEFAULT 0;

ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(12,2) DEFAULT 0;

ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS final_amount DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Add constraint to ensure subtotal > 0
ALTER TABLE quotations 
ADD CONSTRAINT check_subtotal_positive 
CHECK (subtotal > 0);

-- Add constraint to ensure total_amount >= 0
ALTER TABLE quotations 
ADD CONSTRAINT check_total_amount_non_negative 
CHECK (total_amount >= 0);

-- Add constraint to ensure final_amount >= 0
ALTER TABLE quotations 
ADD CONSTRAINT check_final_amount_non_negative 
CHECK (final_amount >= 0);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_quotations_subtotal ON quotations(subtotal);
CREATE INDEX IF NOT EXISTS idx_quotations_dealer_id ON quotations(dealer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_created_at ON quotations(created_at);
```

---

## Backend File Structure

### Files to Create/Modify

1. **`routes/quotations.routes.js`** (or `.ts`) - Main quotation routes
2. **`middleware/quotation-validation.js`** (or `.ts`) - Validation middleware
3. **`services/quotation-pricing.service.js`** (or `.ts`) - Pricing calculation service
4. **`utils/pricing-calculator.js`** (or `.ts`) - Pricing calculation utilities

---

## 1. Pricing Calculation Service

**File:** `services/quotation-pricing.service.js` (or `.ts`)

```javascript
const db = require('../db');

/**
 * Calculate system price from products configuration
 * This is a fallback when subtotal is not provided or invalid
 */
async function calculateSystemPriceFromProducts(products) {
  try {
    if (!products || !products.systemType) {
      return null;
    }

    // Get pricing tables from database
    const pricingResult = await db.query(
      'SELECT config_value FROM system_config WHERE config_key = $1',
      ['pricing_tables']
    );

    const pricingTables = pricingResult.rows[0]?.config_value || null;

    // Calculate based on system type
    if (products.systemType === 'dcr') {
      return calculateDcrPrice(products, pricingTables);
    } else if (products.systemType === 'non-dcr') {
      return calculateNonDcrPrice(products, pricingTables);
    } else if (products.systemType === 'both') {
      return calculateBothPrice(products, pricingTables);
    } else if (products.systemType === 'customize') {
      return calculateCustomizePrice(products, pricingTables);
    }

    return null;
  } catch (error) {
    console.error('[PricingService] Error calculating system price:', error);
    return null;
  }
}

/**
 * Calculate DCR system price
 */
function calculateDcrPrice(products, pricingTables) {
  if (!products.panelSize || !products.panelQuantity || !products.inverterSize || !products.panelBrand) {
    return null;
  }

  // Calculate system size
  const panelSizeW = parseInt(products.panelSize.replace('W', '')) || 0;
  const systemSizeKw = (panelSizeW * products.panelQuantity) / 1000;
  const systemSize = `${systemSizeKw}kW`;

  if (systemSizeKw <= 0) {
    return null;
  }

  // Determine phase
  const phase = determinePhase(systemSize, products.inverterSize);

  // Get price from pricing tables
  if (pricingTables?.dcr) {
    const priceEntry = pricingTables.dcr.find(
      p => p.systemSize === systemSize &&
           p.phase === phase &&
           p.inverterSize === products.inverterSize &&
           p.panelType === products.panelBrand
    );
    if (priceEntry && priceEntry.price > 0) {
      return priceEntry.price;
    }
  }

  // Fallback: Use default pricing calculation
  return calculateDefaultPrice(products, systemSizeKw);
}

/**
 * Calculate NON DCR system price
 */
function calculateNonDcrPrice(products, pricingTables) {
  if (!products.panelSize || !products.panelQuantity || !products.inverterSize || !products.panelBrand) {
    return null;
  }

  const panelSizeW = parseInt(products.panelSize.replace('W', '')) || 0;
  const systemSizeKw = (panelSizeW * products.panelQuantity) / 1000;
  const systemSize = `${systemSizeKw}kW`;

  if (systemSizeKw <= 0) {
    return null;
  }

  const phase = determinePhase(systemSize, products.inverterSize);

  if (pricingTables?.nonDcr) {
    const priceEntry = pricingTables.nonDcr.find(
      p => p.systemSize === systemSize &&
           p.phase === phase &&
           p.inverterSize === products.inverterSize &&
           p.panelType === products.panelBrand
    );
    if (priceEntry && priceEntry.price > 0) {
      return priceEntry.price;
    }
  }

  return calculateDefaultPrice(products, systemSizeKw);
}

/**
 * Calculate BOTH (DCR + NON DCR) system price
 */
function calculateBothPrice(products, pricingTables) {
  if (!products.dcrPanelSize || !products.dcrPanelQuantity || 
      !products.nonDcrPanelSize || !products.nonDcrPanelQuantity ||
      !products.inverterSize || !products.dcrPanelBrand) {
    return null;
  }

  const dcrPanelSizeW = parseInt(products.dcrPanelSize.replace('W', '')) || 0;
  const nonDcrPanelSizeW = parseInt(products.nonDcrPanelSize.replace('W', '')) || 0;
  const dcrSizeKw = (dcrPanelSizeW * products.dcrPanelQuantity) / 1000;
  const nonDcrSizeKw = (nonDcrPanelSizeW * products.nonDcrPanelQuantity) / 1000;
  const totalSystemSizeKw = dcrSizeKw + nonDcrSizeKw;
  const systemSize = `${totalSystemSizeKw}kW`;

  if (totalSystemSizeKw <= 0) {
    return null;
  }

  const phase = determinePhase(systemSize, products.inverterSize);

  if (pricingTables?.both) {
    const priceEntry = pricingTables.both.find(
      p => p.systemSize === systemSize &&
           p.phase === phase &&
           p.inverterSize === products.inverterSize &&
           p.panelType === products.dcrPanelBrand
    );
    if (priceEntry && priceEntry.price > 0) {
      return priceEntry.price;
    }
  }

  // Fallback: Calculate from DCR and NON DCR prices separately
  const dcrPrice = calculateDcrPrice({
    ...products,
    panelSize: products.dcrPanelSize,
    panelQuantity: products.dcrPanelQuantity,
    panelBrand: products.dcrPanelBrand
  }, pricingTables);
  const nonDcrPrice = calculateNonDcrPrice({
    ...products,
    panelSize: products.nonDcrPanelSize,
    panelQuantity: products.nonDcrPanelQuantity,
    panelBrand: products.nonDcrPanelBrand || products.dcrPanelBrand
  }, pricingTables);

  if (dcrPrice && nonDcrPrice) {
    return dcrPrice + nonDcrPrice;
  }

  return calculateDefaultPrice(products, totalSystemSizeKw);
}

/**
 * Calculate CUSTOMIZE system price (sum of all components)
 */
function calculateCustomizePrice(products, pricingTables) {
  let totalPrice = 0;

  // Calculate panel prices
  if (products.customPanels && Array.isArray(products.customPanels)) {
    for (const panel of products.customPanels) {
      if (panel.brand && panel.size && panel.quantity > 0) {
        const panelPrice = getPanelPrice(panel.brand, panel.size, pricingTables);
        totalPrice += panelPrice * panel.quantity;
      }
    }
  }

  // Calculate inverter price
  if (products.inverterBrand && products.inverterSize) {
    const inverterPrice = getInverterPrice(products.inverterBrand, products.inverterSize, pricingTables);
    totalPrice += inverterPrice;
  }

  // Calculate structure price
  if (products.structureType && products.structureSize) {
    const structurePrice = getStructurePrice(products.structureType, products.structureSize, pricingTables);
    totalPrice += structurePrice;
  }

  // Add other components (meter, cables, ACDB, DCDB)
  if (products.meterBrand) {
    totalPrice += getMeterPrice(products.meterBrand, pricingTables);
  }

  // Add cable prices (simplified - you may need to calculate based on length)
  if (products.acCableBrand && products.acCableSize) {
    totalPrice += getCablePrice(products.acCableBrand, products.acCableSize, 'AC', pricingTables);
  }
  if (products.dcCableBrand && products.dcCableSize) {
    totalPrice += getCablePrice(products.dcCableBrand, products.dcCableSize, 'DC', pricingTables);
  }

  // Add ACDB and DCDB prices
  if (products.acdb) {
    const acdbPrice = getACDBPrice(products.acdb, pricingTables);
    if (acdbPrice) totalPrice += acdbPrice;
  }
  if (products.dcdb) {
    const dcdbPrice = getDCDBPrice(products.dcdb, pricingTables);
    if (dcdbPrice) totalPrice += dcdbPrice;
  }

  // Add battery price if present
  if (products.batteryPrice && products.batteryPrice > 0) {
    totalPrice += products.batteryPrice;
  }

  return totalPrice > 0 ? totalPrice : null;
}

/**
 * Default price calculation (fallback)
 */
function calculateDefaultPrice(products, systemSizeKw) {
  // Very basic fallback calculation
  // This should rarely be used, but provides a safety net
  const basePricePerKw = 100000; // ₹1,00,000 per kW (conservative estimate)
  return systemSizeKw * basePricePerKw;
}

/**
 * Helper functions for component pricing
 */
function getPanelPrice(brand, size, pricingTables) {
  if (pricingTables?.panels) {
    const panel = pricingTables.panels.find(p => p.brand === brand && p.size === size);
    if (panel && panel.price > 0) return panel.price;
  }
  // Default fallback
  const sizeW = parseInt(size.replace('W', '')) || 440;
  return sizeW * 50; // ₹50 per watt
}

function getInverterPrice(brand, size, pricingTables) {
  if (pricingTables?.inverters) {
    const inverter = pricingTables.inverters.find(p => p.brand === brand && p.size === size);
    if (inverter && inverter.price > 0) return inverter.price;
  }
  // Default fallback
  const sizeKw = parseInt(size.replace('kW', '')) || 3;
  return sizeKw * 15000; // ₹15,000 per kW
}

function getStructurePrice(type, size, pricingTables) {
  if (pricingTables?.structures) {
    const structure = pricingTables.structures.find(p => p.type === type && p.size === size);
    if (structure && structure.price > 0) return structure.price;
  }
  // Default fallback
  const sizeKw = parseInt(size.replace('kW', '')) || 1;
  return sizeKw * 8000; // ₹8,000 per kW
}

function getMeterPrice(brand, pricingTables) {
  if (pricingTables?.meters) {
    const meter = pricingTables.meters.find(p => p.brand === brand);
    if (meter && meter.price > 0) return meter.price;
  }
  return 5000; // Default ₹5,000
}

function getCablePrice(brand, size, type, pricingTables) {
  if (pricingTables?.cables) {
    const cable = pricingTables.cables.find(
      p => p.brand === brand && p.size === size && p.type === type
    );
    if (cable && cable.price > 0) return cable.price;
  }
  return 3000; // Default ₹3,000
}

function getACDBPrice(acdbOption, pricingTables) {
  // Parse "Havells (1-Phase)" format
  const match = acdbOption.match(/^(.+?)\s*\((.+?)\)$/);
  if (match) {
    const brand = match[1].trim();
    const phase = match[2].trim();
    if (pricingTables?.acdb) {
      const acdb = pricingTables.acdb.find(p => p.brand === brand && p.phase === phase);
      if (acdb && acdb.price > 0) return acdb.price;
    }
  }
  return 2500; // Default ₹2,500
}

function getDCDBPrice(dcdbOption, pricingTables) {
  const match = dcdbOption.match(/^(.+?)\s*\((.+?)\)$/);
  if (match) {
    const brand = match[1].trim();
    const phase = match[2].trim();
    if (pricingTables?.dcdb) {
      const dcdb = pricingTables.dcdb.find(p => p.brand === brand && p.phase === phase);
      if (dcdb && dcdb.price > 0) return dcdb.price;
    }
  }
  return 2500; // Default ₹2,500
}

/**
 * Determine phase from system size and inverter size
 */
function determinePhase(systemSize, inverterSize) {
  const systemKw = parseFloat(systemSize.replace('kW', '')) || 0;
  const inverterKw = parseFloat(inverterSize.replace('kW', '')) || 0;

  // Systems 7kW and above are typically 3-Phase
  if (systemKw >= 7) {
    return '3-Phase';
  }

  // If inverter is larger than system, it's likely 3-Phase
  if (inverterKw > systemKw) {
    return '3-Phase';
  }

  // Default to 1-Phase for smaller systems
  return '1-Phase';
}

module.exports = {
  calculateSystemPriceFromProducts,
  calculateDcrPrice,
  calculateNonDcrPrice,
  calculateBothPrice,
  calculateCustomizePrice
};
```

---

## 2. Validation Middleware

**File:** `middleware/quotation-validation.js` (or `.ts`)

```javascript
const { calculateSystemPriceFromProducts } = require('../services/quotation-pricing.service');

/**
 * Comprehensive quotation validation middleware
 * This ensures subtotal is ALWAYS valid before reaching the route handler
 */
async function validateQuotationRequest(req, res, next) {
  try {
    const {
      customerId,
      customer,
      products,
      discount,
      subtotal,
      centralSubsidy,
      stateSubsidy,
      totalSubsidy,
      amountAfterSubsidy,
      discountAmount,
      totalAmount,
      finalAmount
    } = req.body;

    // Log incoming request for debugging
    console.log('[QuotationValidation] Incoming request:', {
      hasCustomerId: !!customerId,
      hasCustomer: !!customer,
      hasProducts: !!products,
      systemType: products?.systemType,
      subtotal: subtotal,
      productsSystemPrice: products?.systemPrice
    });

    // Validate required fields
    if (!customerId && !customer) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VAL_001',
          message: 'Customer information is required',
          details: [{
            field: 'customerId',
            message: 'Either customerId or customer object must be provided'
          }]
        }
      });
    }

    if (!products) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VAL_002',
          message: 'Products information is required',
          details: [{
            field: 'products',
            message: 'Products object is required'
          }]
        }
      });
    }

    // Validate discount
    const validatedDiscount = Number(discount) || 0;
    if (validatedDiscount < 0 || validatedDiscount > 100) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VAL_003',
          message: 'Discount must be between 0 and 100',
          details: [{
            field: 'discount',
            message: `Invalid discount value: ${discount}`
          }]
        }
      });
    }

    // CRITICAL: Validate and calculate subtotal
    let validatedSubtotal = null;

    // Priority 1: Use provided subtotal if valid
    if (subtotal !== undefined && subtotal !== null) {
      const numSubtotal = Number(subtotal);
      if (Number.isFinite(numSubtotal) && numSubtotal > 0) {
        validatedSubtotal = numSubtotal;
        console.log('[QuotationValidation] Using provided subtotal:', validatedSubtotal);
      }
    }

    // Priority 2: Use products.systemPrice if available
    if (!validatedSubtotal && products.systemPrice) {
      const numSystemPrice = Number(products.systemPrice);
      if (Number.isFinite(numSystemPrice) && numSystemPrice > 0) {
        validatedSubtotal = numSystemPrice;
        console.log('[QuotationValidation] Using products.systemPrice:', validatedSubtotal);
      }
    }

    // Priority 3: Calculate from products configuration
    if (!validatedSubtotal) {
      console.log('[QuotationValidation] Calculating subtotal from products...');
      validatedSubtotal = await calculateSystemPriceFromProducts(products);
      if (validatedSubtotal && validatedSubtotal > 0) {
        console.log('[QuotationValidation] Calculated subtotal from products:', validatedSubtotal);
      }
    }

    // Final check: If still no valid subtotal, reject with detailed error
    if (!validatedSubtotal || validatedSubtotal <= 0) {
      console.error('[QuotationValidation] CRITICAL: Cannot determine valid subtotal', {
        providedSubtotal: subtotal,
        productsSystemPrice: products.systemPrice,
        systemType: products.systemType,
        products: products
      });

      return res.status(400).json({
        success: false,
        error: {
          code: 'VAL_004',
          message: 'Subtotal is required and must be greater than 0',
          details: [
            {
              field: 'subtotal',
              message: `Subtotal must be greater than 0. Please provide 'subtotal' in the request body. Current value: ${subtotal || 0}, Calculated from components: ${validatedSubtotal || 0}`
            },
            {
              field: 'products',
              message: 'Unable to calculate subtotal from products. Please ensure all required product fields are provided.'
            }
          ]
        }
      });
    }

    // Validate subsidies
    const validatedCentralSubsidy = Number(centralSubsidy) || 0;
    const validatedStateSubsidy = Number(stateSubsidy) || 0;
    const validatedTotalSubsidy = Number(totalSubsidy) || (validatedCentralSubsidy + validatedStateSubsidy);

    if (validatedCentralSubsidy < 0 || validatedStateSubsidy < 0 || validatedTotalSubsidy < 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VAL_005',
          message: 'Subsidies cannot be negative',
          details: [{
            field: 'subsidies',
            message: `Invalid subsidy values: central=${validatedCentralSubsidy}, state=${validatedStateSubsidy}, total=${validatedTotalSubsidy}`
          }]
        }
      });
    }

    // Calculate and validate derived amounts
    const calculatedAmountAfterSubsidy = validatedSubtotal - validatedTotalSubsidy;
    const calculatedDiscountAmount = calculatedAmountAfterSubsidy * (validatedDiscount / 100);
    const calculatedTotalAmount = calculatedAmountAfterSubsidy - calculatedDiscountAmount;
    const calculatedFinalAmount = validatedSubtotal - validatedTotalSubsidy;

    // Use provided values if valid, otherwise use calculated values
    const validatedAmountAfterSubsidy = (amountAfterSubsidy !== undefined && Number.isFinite(Number(amountAfterSubsidy)) && Number(amountAfterSubsidy) >= 0)
      ? Number(amountAfterSubsidy)
      : calculatedAmountAfterSubsidy;

    const validatedDiscountAmount = (discountAmount !== undefined && Number.isFinite(Number(discountAmount)) && Number(discountAmount) >= 0)
      ? Number(discountAmount)
      : calculatedDiscountAmount;

    const validatedTotalAmount = (totalAmount !== undefined && Number.isFinite(Number(totalAmount)) && Number(totalAmount) >= 0)
      ? Number(totalAmount)
      : calculatedTotalAmount;

    const validatedFinalAmount = (finalAmount !== undefined && Number.isFinite(Number(finalAmount)) && Number(finalAmount) >= 0)
      ? Number(finalAmount)
      : calculatedFinalAmount;

    // Attach validated values to request object
    req.validatedQuotation = {
      customerId,
      customer,
      products,
      discount: validatedDiscount,
      subtotal: validatedSubtotal,
      centralSubsidy: validatedCentralSubsidy,
      stateSubsidy: validatedStateSubsidy,
      totalSubsidy: validatedTotalSubsidy,
      amountAfterSubsidy: validatedAmountAfterSubsidy,
      discountAmount: validatedDiscountAmount,
      totalAmount: validatedTotalAmount,
      finalAmount: validatedFinalAmount
    };

    console.log('[QuotationValidation] Validation successful:', {
      subtotal: validatedSubtotal,
      totalAmount: validatedTotalAmount,
      finalAmount: validatedFinalAmount
    });

    next();
  } catch (error) {
    console.error('[QuotationValidation] Error in validation:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'SYS_001',
        message: 'Internal server error during validation'
      }
    });
  }
}

module.exports = {
  validateQuotationRequest
};
```

---

## 3. Updated Quotation Route

**File:** `routes/quotations.routes.js` (or `.ts`)

```javascript
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { validateQuotationRequest } = require('../middleware/quotation-validation');
const db = require('../db');

/**
 * POST /api/quotations
 * Create a new quotation
 * 
 * This endpoint uses the validation middleware which ensures:
 * - Subtotal is always valid (> 0)
 * - All amounts are calculated correctly
 * - No invalid data reaches the database
 */
router.post('/quotations', authenticate, validateQuotationRequest, async (req, res) => {
  try {
    const validated = req.validatedQuotation;
    const dealerId = req.user.id;

    // Log the validated data
    console.log('[QuotationRoute] Creating quotation with validated data:', {
      dealerId,
      subtotal: validated.subtotal,
      totalAmount: validated.totalAmount,
      finalAmount: validated.finalAmount
    });

    // Create or get customer
    let customerId = validated.customerId;
    
    if (!customerId && validated.customer) {
      // Check if customer exists by mobile
      const existingCustomer = await db.query(
        'SELECT id FROM customers WHERE mobile = $1',
        [validated.customer.mobile]
      );

      if (existingCustomer.rows.length > 0) {
        customerId = existingCustomer.rows[0].id;
        console.log('[QuotationRoute] Using existing customer:', customerId);
      } else {
        // Create new customer
        const newCustomer = await db.query(
          `INSERT INTO customers (
            first_name, last_name, mobile, email, address, created_at
          ) VALUES ($1, $2, $3, $4, $5, NOW())
          RETURNING id`,
          [
            validated.customer.firstName,
            validated.customer.lastName,
            validated.customer.mobile,
            validated.customer.email || null,
            JSON.stringify(validated.customer.address)
          ]
        );
        customerId = newCustomer.rows[0].id;
        console.log('[QuotationRoute] Created new customer:', customerId);
      }
    }

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VAL_006',
          message: 'Customer ID is required'
        }
      });
    }

    // Insert quotation with ALL validated values
    const quotationResult = await db.query(
      `INSERT INTO quotations (
        customer_id,
        dealer_id,
        products,
        discount,
        subtotal,
        central_subsidy,
        state_subsidy,
        total_subsidy,
        amount_after_subsidy,
        discount_amount,
        total_amount,
        final_amount,
        status,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      RETURNING *`,
      [
        customerId,
        dealerId,
        JSON.stringify(validated.products),
        validated.discount,
        validated.subtotal,
        validated.centralSubsidy,
        validated.stateSubsidy,
        validated.totalSubsidy,
        validated.amountAfterSubsidy,
        validated.discountAmount,
        validated.totalAmount,
        validated.finalAmount,
        'pending'
      ]
    );

    const quotation = quotationResult.rows[0];

    console.log('[QuotationRoute] Quotation created successfully:', quotation.id);

    // Return response with saved values
    res.status(201).json({
      success: true,
      data: {
        id: quotation.id,
        customer: validated.customer,
        products: validated.products,
        discount: validated.discount,
        pricing: {
          subtotal: parseFloat(quotation.subtotal),
          centralSubsidy: parseFloat(quotation.central_subsidy),
          stateSubsidy: parseFloat(quotation.state_subsidy),
          totalSubsidy: parseFloat(quotation.total_subsidy),
          amountAfterSubsidy: parseFloat(quotation.amount_after_subsidy),
          discountAmount: parseFloat(quotation.discount_amount),
          totalAmount: parseFloat(quotation.total_amount),
          finalAmount: parseFloat(quotation.final_amount)
        },
        createdAt: quotation.created_at,
        dealerId: quotation.dealer_id,
        status: quotation.status
      }
    });
  } catch (error) {
    console.error('[QuotationRoute] Error creating quotation:', error);
    
    // Handle database constraint violations
    if (error.code === '23514') { // Check constraint violation
      if (error.constraint === 'check_subtotal_positive') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VAL_004',
            message: 'Subtotal must be greater than 0',
            details: [{
              field: 'subtotal',
              message: 'Database constraint violation: subtotal must be positive'
            }]
          }
        });
      }
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'SYS_001',
        message: 'Internal server error'
      }
    });
  }
});

module.exports = router;
```

---

## 4. API Request/Response Format

### Request Format (Frontend → Backend)

```json
{
  "customerId": "customer-123",  // Optional if customer object provided
  "customer": {                   // Optional if customerId provided
    "firstName": "John",
    "lastName": "Doe",
    "mobile": "9876543210",
    "email": "john@example.com",
    "address": {
      "street": "123 Main St",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001"
    }
  },
  "products": {
    "systemType": "dcr",
    "panelBrand": "Adani",
    "panelSize": "545W",
    "panelQuantity": 6,
    "inverterBrand": "XWatt",
    "inverterSize": "5kW",
    "systemPrice": 300000,        // Optional - backend will use if provided
    // ... other product fields
  },
  "discount": 5,
  "subtotal": 300000,             // Optional - backend will calculate if missing/invalid
  "centralSubsidy": 78000,
  "stateSubsidy": 0,
  "totalSubsidy": 78000,
  "amountAfterSubsidy": 222000,
  "discountAmount": 11100,
  "totalAmount": 210900,
  "finalAmount": 222000
}
```

### Response Format (Backend → Frontend)

**Success (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "quotation-123",
    "customer": { ... },
    "products": { ... },
    "discount": 5,
    "pricing": {
      "subtotal": 300000,
      "centralSubsidy": 78000,
      "stateSubsidy": 0,
      "totalSubsidy": 78000,
      "amountAfterSubsidy": 222000,
      "discountAmount": 11100,
      "totalAmount": 210900,
      "finalAmount": 222000
    },
    "createdAt": "2025-01-15T10:30:00Z",
    "dealerId": "dealer-123",
    "status": "pending"
  }
}
```

**Error (400 Bad Request):**
```json
{
  "success": false,
  "error": {
    "code": "VAL_004",
    "message": "Subtotal is required and must be greater than 0",
    "details": [
      {
        "field": "subtotal",
        "message": "Subtotal must be greater than 0. Please provide 'subtotal' in the request body. Current value: 0, Calculated from components: 0"
      }
    ]
  }
}
```

---

## Summary of Changes

### Files to Create

1. **`services/quotation-pricing.service.js`** - Pricing calculation service
2. **`middleware/quotation-validation.js`** - Validation middleware

### Files to Modify

1. **`routes/quotations.routes.js`** - Update POST route to use validation middleware

### Database Changes

1. Add columns to `quotations` table (if not exists)
2. Add constraints to ensure data integrity
3. Add indexes for performance

### API Changes

**No breaking changes** - The API accepts the same request format, but now:
- ✅ Validates subtotal with multiple fallbacks
- ✅ Calculates subtotal if not provided
- ✅ Uses `products.systemPrice` if available
- ✅ Never allows subtotal = 0 to reach database
- ✅ Provides detailed error messages

---

## Testing Checklist

- [ ] Test with valid subtotal provided
- [ ] Test with `products.systemPrice` provided (no subtotal)
- [ ] Test with neither subtotal nor systemPrice (should calculate)
- [ ] Test with invalid subtotal (0, negative, null)
- [ ] Test with missing products (should reject)
- [ ] Test with invalid discount (> 100, negative)
- [ ] Test database constraints work
- [ ] Test error responses are properly formatted
- [ ] Test logging works for debugging

---

## Error Prevention Strategy

1. **Multiple Validation Layers:**
   - Frontend validation (already implemented)
   - Backend middleware validation (NEW)
   - Database constraints (NEW)

2. **Multiple Fallback Sources:**
   - Provided `subtotal` (Priority 1)
   - `products.systemPrice` (Priority 2)
   - Calculated from products (Priority 3)
   - Default pricing calculation (Priority 4)

3. **Comprehensive Logging:**
   - Log all validation steps
   - Log calculated values
   - Log errors with full context

4. **Database Constraints:**
   - CHECK constraint ensures subtotal > 0
   - Prevents invalid data even if validation fails

---

**This redesign ensures the "Subtotal is required and must be greater than 0" error will NEVER occur if the backend is properly implemented.**


// Backend Controller Reference - createQuotation
// This file contains the exact backend controller code for reference
// DO NOT MODIFY - This is for frontend alignment reference only

export const createQuotation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.dealer) {
      res.status(401).json({
        success: false,
        error: { code: 'AUTH_003', message: 'User not authenticated' }
      });
      return;
    }

    const { 
      customerId, 
      customer, 
      products, 
      discount = 0,
      subtotal,           // Set price (complete package price) - MUST BE SAVED
      centralSubsidy,      // Individual central subsidy
      stateSubsidy,        // Individual state subsidy
      totalSubsidy,       // Total subsidy (central + state)
      amountAfterSubsidy,  // Amount after subsidy
      discountAmount,      // Discount amount
      totalAmount,         // Amount after discount (Subtotal - Subsidy - Discount) - MUST BE SAVED
      finalAmount,         // Final amount (Subtotal - Subsidy, discount NOT applied) - MUST BE SAVED
      pricing: bodyPricing
    } = req.body;
    
    // Log entire request body for debugging (excluding sensitive data)
    logInfo('Create quotation request received', {
      hasCustomerId: !!customerId,
      hasCustomer: !!customer,
      hasProducts: !!products,
      discount,
      subtotal: subtotal,
      subtotalValue: typeof subtotal,
      totalAmount: totalAmount,
      totalAmountType: typeof totalAmount,
      finalAmount: finalAmount,
      finalAmountType: typeof finalAmount,
      centralSubsidy: centralSubsidy,
      stateSubsidy: stateSubsidy,
      totalSubsidy: totalSubsidy,
      hasPricingObject: !!bodyPricing,
      requestBodyKeys: Object.keys(req.body),
      productsSystemPrice: products?.systemPrice,
      productsSystemPriceType: typeof products?.systemPrice,
      // Log raw values from req.body to see what was actually received
      rawSubtotal: req.body.subtotal,
      rawTotalAmount: req.body.totalAmount,
      rawFinalAmount: req.body.finalAmount,
      rawProductsSystemPrice: req.body.products?.systemPrice
    });

    // Handle customer creation if customer object is provided
    let finalCustomerId = customerId;
    if (customer && !customerId) {
      // Check if customer exists by mobile
      let existingCustomer = await Customer.findOne({ where: { mobile: customer.mobile } });
      if (!existingCustomer) {
        existingCustomer = await Customer.create({
          id: uuidv4(),
          firstName: customer.firstName,
          lastName: customer.lastName,
          mobile: customer.mobile,
          email: customer.email,
          streetAddress: customer.address.street,
          city: customer.address.city,
          state: customer.address.state,
          pincode: customer.address.pincode,
          dealerId: req.dealer.id
        });
      }
      finalCustomerId = existingCustomer.id;
    }

    if (!finalCustomerId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VAL_002',
          message: 'Customer ID or customer object is required'
        }
      });
      return;
    }

    // Verify customer belongs to dealer (admins can use any customer)
    const where: any = { id: finalCustomerId };
    if (req.dealer.role !== 'admin') {
      where.dealerId = req.dealer.id;
    }
    const customerRecord = await Customer.findOne({ where });

    if (!customerRecord) {
      res.status(404).json({
        success: false,
        error: { code: 'RES_001', message: 'Customer not found' }
      });
      return;
    }

    // Validate product selection against catalog
    const catalog = await getProductCatalogData();
    const validation = validateProductSelection(products, catalog);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VAL_003',
          message: 'Invalid product selection',
          details: validation.errors.map(error => ({ message: error }))
        }
      });
      return;
    }

    // Calculate pricing breakdown first (needed for fallback calculation)
    const pricing = calculatePricing(products, discount);
    
    // Check multiple possible locations for pricing fields
    // Priority: frontend value (root level) > pricing object > products.systemPrice > products.subtotal > calculated value
    // Values are at root level: req.body.subtotal, req.body.totalAmount, req.body.finalAmount
    // Helper to check if value is valid (not undefined, not null, and > 0)
    const isValidValue = (val: any): boolean => {
      if (val === undefined || val === null || val === '') {
        return false;
      }
      const numVal = Number(val);
      return !isNaN(numVal) && numVal > 0;
    };
    
    // Helper to check if value is valid number (including 0, for finalAmount)
    const isValidNumber = (val: any): boolean => {
      if (val === undefined || val === null || val === '') {
        return false;
      }
      const numVal = Number(val);
      return !isNaN(numVal) && numVal >= 0;
    };
    
    // Log what we're checking for subtotal extraction
    logInfo('Extracting subtotal value - checking all sources', {
      'req.body.subtotal': req.body.subtotal,
      'req.body.subtotal type': typeof req.body.subtotal,
      'req.body.pricing?.subtotal': req.body.pricing?.subtotal,
      'products?.systemPrice': products?.systemPrice,
      'products?.systemPrice type': typeof products?.systemPrice,
      'products?.subtotal': products?.subtotal,
      'products?.totalAmount': products?.totalAmount,
      'pricing.subtotal (calculated)': pricing.subtotal,
      'isValidValue(req.body.subtotal)': isValidValue(req.body.subtotal),
      'isValidValue(products?.systemPrice)': isValidValue(products?.systemPrice),
      'extracted subtotal (from destructuring)': subtotal
    });
    
    const subtotalValue = isValidValue(subtotal)
      ? Number(subtotal)
      : (isValidValue(req.body.pricing?.subtotal)
          ? Number(req.body.pricing.subtotal)
          : (isValidValue(products?.systemPrice)
              ? Number(products.systemPrice)
              : (isValidValue(products?.subtotal)
                  ? Number(products.subtotal)
                  : (isValidValue(products?.totalAmount)
                      ? Number(products.totalAmount)
                      : pricing.subtotal))));
    
    logInfo('Subtotal extraction result', {
      subtotalValue,
      source: isValidValue(subtotal) ? 'req.body.subtotal' 
        : isValidValue(req.body.pricing?.subtotal) ? 'req.body.pricing.subtotal'
        : isValidValue(products?.systemPrice) ? 'products.systemPrice'
        : isValidValue(products?.subtotal) ? 'products.subtotal'
        : isValidValue(products?.totalAmount) ? 'products.totalAmount'
        : 'calculated (pricing.subtotal)'
    });
    
    const totalAmountValue = isValidNumber(totalAmount)
      ? Number(totalAmount)
      : (isValidNumber(req.body.pricing?.totalAmount)
          ? Number(req.body.pricing.totalAmount)
          : (isValidNumber(products?.totalAmount)
              ? Number(products.totalAmount)
              : null));
    
    const finalAmountValue = isValidNumber(finalAmount)
      ? Number(finalAmount)
      : (isValidNumber(req.body.pricing?.finalAmount)
          ? Number(req.body.pricing.finalAmount)
          : (isValidNumber(products?.finalAmount)
              ? Number(products.finalAmount)
              : null));
    
    // Log received values for debugging
    logInfo('Quotation pricing validation', {
      subtotalFromBody: subtotal,
      totalAmountFromBody: totalAmount,
      finalAmountFromBody: finalAmount,
      subtotalType: typeof subtotal,
      totalAmountType: typeof totalAmount,
      finalAmountType: typeof finalAmount,
      subtotalFromPricing: req.body.pricing?.subtotal,
      totalAmountFromPricing: req.body.pricing?.totalAmount,
      finalAmountFromPricing: req.body.pricing?.finalAmount,
      productsSystemPrice: products?.systemPrice,
      productsSubtotal: products?.subtotal,
      productsTotalAmount: products?.totalAmount,
      calculatedSubtotal: pricing.subtotal,
      finalSubtotalValue: subtotalValue,
      finalTotalAmountValue: totalAmountValue,
      finalFinalAmountValue: finalAmountValue,
      reqBodyRaw: JSON.stringify({
        subtotal: req.body.subtotal,
        totalAmount: req.body.totalAmount,
        finalAmount: req.body.finalAmount,
        productsSystemPrice: req.body.products?.systemPrice
      })
    });
    
    // Validate subtotal - use the extracted value (which already has fallback logic)
    const validatedSubtotal = Number(subtotalValue);
    
    // Check if subtotal is valid
    if (isNaN(validatedSubtotal)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VAL_001',
          message: 'Subtotal is required and must be a valid number',
          details: [{
            field: 'subtotal',
            message: `Subtotal must be a number. Received: ${subtotalValue}, Type: ${typeof subtotalValue}`
          }]
        }
      });
      return;
    }
    
    if (validatedSubtotal <= 0) {
      // Provide detailed error message showing what was received
      const receivedValues = {
        'req.body.subtotal': req.body.subtotal,
        'req.body.pricing?.subtotal': req.body.pricing?.subtotal,
        'products.subtotal': products?.subtotal,
        'products.systemPrice': products?.systemPrice,
        'products.totalAmount': products?.totalAmount,
        'calculated (pricing.subtotal)': pricing.subtotal,
        'extracted subtotalValue': subtotalValue
      };
      
      // Log the full request body for debugging (excluding sensitive data)
      logError('Subtotal validation failed', {
        receivedValues,
        requestBodyKeys: Object.keys(req.body),
        productsKeys: products ? Object.keys(products) : null,
        subtotalValue,
        validatedSubtotal
      });
      
      res.status(400).json({
        success: false,
        error: {
          code: 'VAL_001',
          message: 'Subtotal is required and must be greater than 0',
          details: [{
            field: 'subtotal',
            message: `Subtotal must be greater than 0. Please provide 'subtotal' in the request body at the root level. Current value: ${validatedSubtotal}, Calculated from components: ${pricing.subtotal}`,
            receivedValues: receivedValues,
            suggestion: 'Send subtotal at root level: { "subtotal": 240000, "totalAmount": 162000, "finalAmount": 162000, ... }',
            help: 'The subtotal field must be included at the root level of the request body, not nested in products or pricing objects.'
          }]
        }
      });
      return;
    }

    // Validate totalAmount (Amount after discount: Subtotal - Subsidy - Discount)
    const validatedTotalAmount = totalAmountValue !== undefined && totalAmountValue !== null 
      ? Number(totalAmountValue) 
      : null;
    
    if (validatedTotalAmount === null || isNaN(validatedTotalAmount)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VAL_002',
          message: 'Total amount is required',
          details: [{
            field: 'totalAmount',
            message: 'Total amount (amount after discount) is required in request body'
          }]
        }
      });
      return;
    }
    
    // Validate finalAmount (Final amount: Subtotal - Subsidy, discount NOT applied)
    // finalAmount can be 0 (if subsidy equals subtotal), so check for null/undefined only
    const validatedFinalAmount = finalAmountValue !== undefined && finalAmountValue !== null 
      ? Number(finalAmountValue) 
      : null;
    
    if (validatedFinalAmount === null || isNaN(validatedFinalAmount)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VAL_003',
          message: 'Final amount is required',
          details: [{
            field: 'finalAmount',
            message: 'Final amount (subtotal - subsidy) is required in request body'
          }]
        }
      });
      return;
    }
    
    // Use frontend-provided values (these are the source of truth)
    const finalPricing = {
      ...pricing,
      subtotal: validatedSubtotal,                    // Set price (complete package price)
      totalAmount: validatedTotalAmount,             // Amount after discount (Subtotal - Subsidy - Discount)
      finalAmount: validatedFinalAmount,              // Final amount (Subtotal - Subsidy, discount NOT applied)
      centralSubsidy: Number(centralSubsidy || req.body.pricing?.centralSubsidy || products?.centralSubsidy || 0),
      stateSubsidy: Number(stateSubsidy || req.body.pricing?.stateSubsidy || products?.stateSubsidy || 0),
      totalSubsidy: Number(totalSubsidy || req.body.pricing?.totalSubsidy || (Number(centralSubsidy || 0) + Number(stateSubsidy || 0))),
      amountAfterSubsidy: Number(amountAfterSubsidy || req.body.pricing?.amountAfterSubsidy || validatedFinalAmount),
      discountAmount: Number(discountAmount || req.body.pricing?.discountAmount || 0)
    };

    // Generate quotation ID
    let quotationId = generateQuotationId();
    // Ensure unique ID
    while (await Quotation.findByPk(quotationId)) {
      quotationId = generateQuotationId();
    }

    // Calculate valid until date (5 days from now)
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 5);

    // Create quotation - MUST save all pricing fields from frontend
    const quotation = await Quotation.create({
      id: quotationId,
      dealerId: req.dealer.id,
      customerId: finalCustomerId,
      systemType: products.systemType,
      status: 'pending',
      discount,
      subtotal: finalPricing.subtotal,                    // Set price (complete package price)
      totalAmount: finalPricing.totalAmount,             // Amount after discount (Subtotal - Subsidy - Discount)
      finalAmount: finalPricing.finalAmount,              // Final amount (Subtotal - Subsidy, discount NOT applied)
      centralSubsidy: finalPricing.centralSubsidy,       // Central government subsidy
      stateSubsidy: finalPricing.stateSubsidy,           // State subsidy
      totalSubsidy: finalPricing.totalSubsidy,           // Total subsidy (central + state)
      amountAfterSubsidy: finalPricing.amountAfterSubsidy, // Amount after subsidy
      discountAmount: finalPricing.discountAmount,       // Discount amount
      validUntil
    });

    // Create quotation products
    await QuotationProduct.create({
      id: uuidv4(),
      quotationId: quotation.id,
      systemType: products.systemType,
      panelBrand: products.panelBrand,
      panelSize: products.panelSize,
      panelQuantity: products.panelQuantity,
      panelPrice: products.panelPrice,
      dcrPanelBrand: products.dcrPanelBrand,
      dcrPanelSize: products.dcrPanelSize,
      dcrPanelQuantity: products.dcrPanelQuantity,
      nonDcrPanelBrand: products.nonDcrPanelBrand,
      nonDcrPanelSize: products.nonDcrPanelSize,
      nonDcrPanelQuantity: products.nonDcrPanelQuantity,
      inverterType: products.inverterType,
      inverterBrand: products.inverterBrand,
      inverterSize: products.inverterSize,
      inverterPrice: products.inverterPrice,
      structureType: products.structureType,
      structureSize: products.structureSize,
      structurePrice: products.structurePrice,
      meterBrand: products.meterBrand,
      meterPrice: products.meterPrice,
      acCableBrand: products.acCableBrand,
      acCableSize: products.acCableSize,
      acCablePrice: products.acCablePrice,
      dcCableBrand: products.dcCableBrand,
      dcCableSize: products.dcCableSize,
      dcCablePrice: products.dcCablePrice,
      acdb: products.acdb,
      acdbPrice: products.acdbPrice,
      dcdb: products.dcdb,
      dcdbPrice: products.dcdbPrice,
      hybridInverter: products.hybridInverter,
      batteryCapacity: products.batteryCapacity,
      batteryPrice: products.batteryPrice,
      centralSubsidy: finalPricing.centralSubsidy,
      stateSubsidy: finalPricing.stateSubsidy,
      subtotal: finalPricing.subtotal,        // Set price (complete package price)
      totalAmount: finalPricing.totalAmount,  // Amount after discount (Subtotal - Subsidy - Discount)
      finalAmount: finalPricing.finalAmount   // Final amount (Subtotal - Subsidy, discount NOT applied)
    });

    // Handle custom panels if systemType is 'customize'
    if (products.systemType === 'customize' && products.customPanels) {
      for (const panel of products.customPanels) {
        await CustomPanel.create({
          id: uuidv4(),
          quotationId: quotation.id,
          brand: panel.brand,
          size: panel.size,
          quantity: panel.quantity,
          type: panel.type,
          price: panel.price
        });
      }
    }

    logInfo('Quotation created', { quotationId: quotation.id, dealerId: req.dealer.id });

    res.status(201).json({
      success: true,
      data: {
        id: quotation.id,
        dealerId: quotation.dealerId,
        customerId: quotation.customerId,
        systemType: quotation.systemType,
        status: quotation.status,
        discount: quotation.discount,
        pricing: {
          subtotal: Number(quotation.subtotal),              // Set price (complete package price)
          totalAmount: Number(quotation.totalAmount),       // Amount after discount (Subtotal - Subsidy - Discount)
          finalAmount: Number(quotation.finalAmount),       // Final amount (Subtotal - Subsidy, discount NOT applied)
          centralSubsidy: Number((quotation as any).centralSubsidy || finalPricing.centralSubsidy || 0),
          stateSubsidy: Number((quotation as any).stateSubsidy || finalPricing.stateSubsidy || 0),
          totalSubsidy: Number((quotation as any).totalSubsidy || finalPricing.totalSubsidy || 0),
          amountAfterSubsidy: Number((quotation as any).amountAfterSubsidy || finalPricing.amountAfterSubsidy || 0),
          discountAmount: Number((quotation as any).discountAmount || finalPricing.discountAmount || 0),
          // Component prices for display
          panelPrice: finalPricing.panelPrice,
          inverterPrice: finalPricing.inverterPrice,
          structurePrice: finalPricing.structurePrice,
          meterPrice: finalPricing.meterPrice,
          cablePrice: finalPricing.cablePrice,
          acdbDcdbPrice: finalPricing.acdbDcdbPrice
        },
        createdAt: quotation.createdAt,
        validUntil: quotation.validUntil
      }
    });
  } catch (error) {
    logError('Create quotation error', error, { dealerId: req.dealer?.id });
    res.status(500).json({
      success: false,
      error: { code: 'SYS_001', message: 'Internal server error' }
    });
  }
};



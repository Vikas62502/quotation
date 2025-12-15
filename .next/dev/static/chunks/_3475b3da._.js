(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/lib/dummy-data.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "dummyCustomers",
    ()=>dummyCustomers,
    "dummyDealers",
    ()=>dummyDealers,
    "dummyVisitors",
    ()=>dummyVisitors,
    "generateDummyQuotations",
    ()=>generateDummyQuotations,
    "loginCredentials",
    ()=>loginCredentials,
    "seedDummyData",
    ()=>seedDummyData
]);
const dummyDealers = [
    {
        id: "dealer-001",
        username: "demo",
        password: "demo123",
        firstName: "Rajesh",
        lastName: "Kumar",
        mobile: "9876543210",
        email: "rajesh.kumar@solardealer.com",
        gender: "Male",
        dateOfBirth: "1985-06-15",
        fatherName: "Suresh Kumar",
        fatherContact: "9876543211",
        governmentIdType: "Aadhaar Card",
        governmentIdNumber: "1234-5678-9012",
        address: {
            street: "123, Solar Complex, MG Road",
            city: "Ahmedabad",
            state: "Gujarat",
            pincode: "380001"
        }
    },
    {
        id: "dealer-002",
        username: "admin",
        password: "admin123",
        firstName: "Priya",
        lastName: "Sharma",
        mobile: "9988776655",
        email: "priya.sharma@greenenergy.com",
        gender: "Female",
        dateOfBirth: "1990-03-22",
        fatherName: "Ramesh Sharma",
        fatherContact: "9988776656",
        governmentIdType: "PAN Card",
        governmentIdNumber: "ABCDE1234F",
        address: {
            street: "456, Green Tower, Ring Road",
            city: "Jaipur",
            state: "Rajasthan",
            pincode: "302001"
        }
    },
    {
        id: "dealer-003",
        username: "testuser",
        password: "test123",
        firstName: "Amit",
        lastName: "Patel",
        mobile: "8765432109",
        email: "amit.patel@sunpower.in",
        gender: "Male",
        dateOfBirth: "1988-11-08",
        fatherName: "Mahesh Patel",
        fatherContact: "8765432110",
        governmentIdType: "Voter ID",
        governmentIdNumber: "GJ/01/123/456789",
        address: {
            street: "789, Industrial Area, Phase 2",
            city: "Surat",
            state: "Gujarat",
            pincode: "395003"
        }
    }
];
const dummyCustomers = [
    {
        firstName: "Vikram",
        lastName: "Singh",
        mobile: "9123456780",
        email: "vikram.singh@gmail.com",
        address: {
            street: "12, Lakshmi Nagar",
            city: "Mumbai",
            state: "Maharashtra",
            pincode: "400001"
        }
    },
    {
        firstName: "Anita",
        lastName: "Desai",
        mobile: "9234567891",
        email: "anita.desai@yahoo.com",
        address: {
            street: "45, Green Park Colony",
            city: "Pune",
            state: "Maharashtra",
            pincode: "411001"
        }
    },
    {
        firstName: "Mohan",
        lastName: "Reddy",
        mobile: "9345678902",
        email: "mohan.reddy@outlook.com",
        address: {
            street: "78, Jubilee Hills",
            city: "Hyderabad",
            state: "Telangana",
            pincode: "500033"
        }
    },
    {
        firstName: "Sunita",
        lastName: "Verma",
        mobile: "9456789013",
        email: "sunita.verma@gmail.com",
        address: {
            street: "23, Civil Lines",
            city: "Jaipur",
            state: "Rajasthan",
            pincode: "302006"
        }
    },
    {
        firstName: "Karthik",
        lastName: "Nair",
        mobile: "9567890124",
        email: "karthik.nair@gmail.com",
        address: {
            street: "56, Marine Drive",
            city: "Kochi",
            state: "Kerala",
            pincode: "682001"
        }
    },
    {
        firstName: "Deepak",
        lastName: "Gupta",
        mobile: "9678901235",
        email: "deepak.gupta@company.com",
        address: {
            street: "89, Sector 15",
            city: "Gurugram",
            state: "Haryana",
            pincode: "122001"
        }
    },
    {
        firstName: "Lakshmi",
        lastName: "Iyer",
        mobile: "9789012346",
        email: "lakshmi.iyer@email.com",
        address: {
            street: "34, Anna Nagar",
            city: "Chennai",
            state: "Tamil Nadu",
            pincode: "600040"
        }
    },
    {
        firstName: "Rahul",
        lastName: "Joshi",
        mobile: "9890123457",
        email: "rahul.joshi@mail.com",
        address: {
            street: "67, Model Town",
            city: "Lucknow",
            state: "Uttar Pradesh",
            pincode: "226001"
        }
    }
];
// Dummy Product Selections
const dummyProducts = [
    {
        systemType: "dcr",
        panelBrand: "Adani",
        panelSize: "545W",
        panelQuantity: 10,
        inverterType: "String Inverter",
        inverterBrand: "Growatt",
        inverterSize: "5kW",
        structureType: "GI Structure",
        structureSize: "5kW",
        meterBrand: "L&T",
        acCableBrand: "Polycab",
        acCableSize: "6 sq mm",
        dcCableBrand: "Havells",
        dcCableSize: "4 sq mm",
        acdb: "2-String",
        dcdb: "2-String",
        centralSubsidy: 78000,
        stateSubsidy: 10000
    },
    {
        systemType: "non-dcr",
        panelBrand: "Tata",
        panelSize: "550W",
        panelQuantity: 8,
        inverterType: "String Inverter",
        inverterBrand: "Solis",
        inverterSize: "3kW",
        structureType: "Aluminum Structure",
        structureSize: "3kW",
        meterBrand: "Havells",
        acCableBrand: "KEI",
        acCableSize: "4 sq mm",
        dcCableBrand: "Polycab",
        dcCableSize: "4 sq mm",
        acdb: "1-String",
        dcdb: "2-String"
    },
    {
        systemType: "hybrid",
        panelBrand: "Waaree",
        panelSize: "540W",
        panelQuantity: 12,
        inverterType: "Hybrid Inverter",
        inverterBrand: "Growatt",
        inverterSize: "6kW",
        structureType: "GI Structure",
        structureSize: "5kW",
        meterBrand: "Genus",
        acCableBrand: "Polycab",
        acCableSize: "10 sq mm",
        dcCableBrand: "Havells",
        dcCableSize: "6 sq mm",
        acdb: "2-String",
        dcdb: "3-String",
        hybridInverter: "Growatt SPH 6000",
        batteryCapacity: "10kWh",
        batteryPrice: 85000
    },
    {
        systemType: "dcr",
        panelBrand: "Vikram Solar",
        panelSize: "555W",
        panelQuantity: 20,
        inverterType: "String Inverter",
        inverterBrand: "Fronius",
        inverterSize: "10kW",
        structureType: "MS Structure",
        structureSize: "10kW",
        meterBrand: "L&T",
        acCableBrand: "Finolex",
        acCableSize: "16 sq mm",
        dcCableBrand: "KEI",
        dcCableSize: "10 sq mm",
        acdb: "3-String",
        dcdb: "4-String",
        centralSubsidy: 78000,
        stateSubsidy: 15000
    },
    {
        systemType: "both",
        panelBrand: "Adani",
        panelSize: "545W",
        panelQuantity: 15,
        inverterType: "String Inverter",
        inverterBrand: "Delta",
        inverterSize: "8kW",
        structureType: "Aluminum Structure",
        structureSize: "10kW",
        meterBrand: "HPL",
        acCableBrand: "RR Kabel",
        acCableSize: "10 sq mm",
        dcCableBrand: "Polycab",
        dcCableSize: "6 sq mm",
        acdb: "2-String",
        dcdb: "3-String"
    }
];
function generateDummyQuotations() {
    const quotations = [];
    const now = new Date();
    // Generate quotations for each dealer
    dummyDealers.forEach((dealer, dealerIndex)=>{
        // Assign 2-4 quotations per dealer
        const numQuotations = 2 + dealerIndex % 3;
        for(let i = 0; i < numQuotations; i++){
            const customerIndex = (dealerIndex * 3 + i) % dummyCustomers.length;
            const productIndex = (dealerIndex + i) % dummyProducts.length;
            // Generate dates spread across current and previous month
            const daysAgo = Math.floor(Math.random() * 45);
            const quotationDate = new Date(now);
            quotationDate.setDate(quotationDate.getDate() - daysAgo);
            const products = dummyProducts[productIndex];
            const panelPrice = Number.parseInt(products.panelSize) * products.panelQuantity * 25;
            const inverterPrice = Number.parseInt(products.inverterSize) * 8000;
            const structurePrice = Number.parseInt(products.structureSize) * 5000;
            const cablePrice = 15000;
            const meterPrice = 8000;
            const acdbDcdbPrice = 12000;
            let totalAmount = panelPrice + inverterPrice + structurePrice + cablePrice + meterPrice + acdbDcdbPrice;
            if (products.batteryPrice) {
                totalAmount += products.batteryPrice;
            }
            const discount = [
                5,
                8,
                10,
                12,
                15
            ][Math.floor(Math.random() * 5)];
            const finalAmount = totalAmount - totalAmount * discount / 100;
            quotations.push({
                id: `QT-${1000 + quotations.length}`,
                customer: dummyCustomers[customerIndex],
                products: products,
                discount,
                totalAmount,
                finalAmount,
                createdAt: quotationDate.toISOString(),
                dealerId: dealer.id,
                status: [
                    "pending",
                    "approved",
                    "rejected",
                    "completed"
                ][Math.floor(Math.random() * 4)]
            });
        }
    });
    return quotations;
}
function seedDummyData() {
    // Always ensure visitors exist (they might be deleted or missing)
    const existingVisitors = JSON.parse(localStorage.getItem("visitors") || "[]");
    if (existingVisitors.length === 0) {
        localStorage.setItem("visitors", JSON.stringify(dummyVisitors));
    } else {
        // Merge with dummy visitors to ensure all dummy visitors exist
        const mergedVisitors = [
            ...existingVisitors
        ];
        dummyVisitors.forEach((dummyVisitor)=>{
            const exists = mergedVisitors.find((v)=>v.id === dummyVisitor.id || v.username === dummyVisitor.username);
            if (!exists) {
                mergedVisitors.push(dummyVisitor);
            } else {
                // Update existing visitor to ensure password is correct
                const index = mergedVisitors.findIndex((v)=>v.id === dummyVisitor.id || v.username === dummyVisitor.username);
                if (index !== -1) {
                    mergedVisitors[index] = {
                        ...mergedVisitors[index],
                        password: dummyVisitor.password
                    };
                }
            }
        });
        localStorage.setItem("visitors", JSON.stringify(mergedVisitors));
    }
    // Check if data already seeded
    const isSeeded = localStorage.getItem("dummyDataSeeded");
    if (!isSeeded) {
        // Seed dealers
        const existingDealers = JSON.parse(localStorage.getItem("dealers") || "[]");
        if (existingDealers.length === 0) {
            localStorage.setItem("dealers", JSON.stringify(dummyDealers));
        }
        // Seed quotations
        const existingQuotations = JSON.parse(localStorage.getItem("quotations") || "[]");
        if (existingQuotations.length === 0) {
            const dummyQuotations = generateDummyQuotations();
            localStorage.setItem("quotations", JSON.stringify(dummyQuotations));
        }
        localStorage.setItem("dummyDataSeeded", "true");
    }
}
const dummyVisitors = [
    {
        id: "visitor-001",
        username: "visitor1",
        password: "visitor123",
        firstName: "Rahul",
        lastName: "Singh",
        mobile: "9876543210",
        email: "rahul.singh@example.com"
    },
    {
        id: "visitor-002",
        username: "visitor2",
        password: "visitor123",
        firstName: "Sneha",
        lastName: "Verma",
        mobile: "9876543211",
        email: "sneha.verma@example.com"
    },
    {
        id: "visitor-003",
        username: "visitor3",
        password: "visitor123",
        firstName: "Vikram",
        lastName: "Yadav",
        mobile: "9876543212",
        email: "vikram.yadav@example.com"
    }
];
const loginCredentials = [
    {
        username: "demo",
        password: "demo123",
        name: "Rajesh Kumar (Dealer)"
    },
    {
        username: "admin",
        password: "admin123",
        name: "Priya Sharma (Admin)"
    },
    {
        username: "testuser",
        password: "test123",
        name: "Amit Patel (Dealer)"
    },
    {
        username: "visitor1",
        password: "visitor123",
        name: "Rahul Singh (Visitor)"
    },
    {
        username: "visitor2",
        password: "visitor123",
        name: "Sneha Verma (Visitor)"
    },
    {
        username: "visitor3",
        password: "visitor123",
        name: "Vikram Yadav (Visitor)"
    }
];
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/auth-context.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AuthProvider",
    ()=>AuthProvider,
    "useAuth",
    ()=>useAuth
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$dummy$2d$data$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/dummy-data.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
"use client";
;
;
const AuthContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(undefined);
function AuthProvider({ children }) {
    _s();
    const [dealer, setDealer] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [visitor, setVisitor] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [role, setRole] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [isAuthenticated, setIsAuthenticated] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AuthProvider.useEffect": ()=>{
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$dummy$2d$data$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["seedDummyData"])();
            // Check for existing session
            const savedDealer = localStorage.getItem("dealer");
            const savedVisitor = localStorage.getItem("visitor");
            const savedRole = localStorage.getItem("userRole");
            if (savedDealer) {
                setDealer(JSON.parse(savedDealer));
                setRole(savedRole || "dealer");
                setIsAuthenticated(true);
            } else if (savedVisitor) {
                setVisitor(JSON.parse(savedVisitor));
                setRole("visitor");
                setIsAuthenticated(true);
            }
        }
    }["AuthProvider.useEffect"], []);
    const login = async (username, password)=>{
        // Check dealers first
        const dealers = JSON.parse(localStorage.getItem("dealers") || "[]");
        const foundDealer = dealers.find((d)=>d.username === username && d.password === password);
        if (foundDealer) {
            const { password: _, ...dealerData } = foundDealer;
            setDealer(dealerData);
            setVisitor(null);
            const userRole = username === "admin" ? "admin" : "dealer";
            setRole(userRole);
            setIsAuthenticated(true);
            localStorage.setItem("dealer", JSON.stringify(dealerData));
            localStorage.setItem("userRole", userRole);
            localStorage.removeItem("visitor");
            return true;
        }
        // Check visitors
        const visitors = JSON.parse(localStorage.getItem("visitors") || "[]");
        const foundVisitor = visitors.find((v)=>{
            return v.username === username && v.password === password;
        });
        if (foundVisitor) {
            const { password: _, ...visitorData } = foundVisitor;
            setVisitor(visitorData);
            setDealer(null);
            setRole("visitor");
            setIsAuthenticated(true);
            localStorage.setItem("visitor", JSON.stringify(visitorData));
            localStorage.setItem("userRole", "visitor");
            localStorage.removeItem("dealer");
            return true;
        }
        return false;
    };
    const logout = ()=>{
        setDealer(null);
        setVisitor(null);
        setRole(null);
        setIsAuthenticated(false);
        localStorage.removeItem("dealer");
        localStorage.removeItem("visitor");
        localStorage.removeItem("userRole");
    };
    const register = async (dealerData)=>{
        const dealers = JSON.parse(localStorage.getItem("dealers") || "[]");
        const exists = dealers.find((d)=>d.username === dealerData.username || d.email === dealerData.email);
        if (exists) {
            return false;
        }
        dealers.push(dealerData);
        localStorage.setItem("dealers", JSON.stringify(dealers));
        return true;
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AuthContext.Provider, {
        value: {
            dealer,
            visitor,
            role,
            isAuthenticated,
            login,
            logout,
            register
        },
        children: children
    }, void 0, false, {
        fileName: "[project]/lib/auth-context.tsx",
        lineNumber: 139,
        columnNumber: 5
    }, this);
}
_s(AuthProvider, "GFpb8UFv47wqRVLLh6IGHzJyjL0=");
_c = AuthProvider;
function useAuth() {
    _s1();
    const context = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
_s1(useAuth, "b9L3QQ+jgeyIrH0NfHrJ8nn7VMU=");
var _c;
__turbopack_context__.k.register(_c, "AuthProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/quotation-context.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "QuotationProvider",
    ()=>QuotationProvider,
    "useQuotation",
    ()=>useQuotation
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
"use client";
;
const QuotationContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(undefined);
function QuotationProvider({ children }) {
    _s();
    // Load from localStorage on mount
    const [currentCustomer, setCurrentCustomerState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "QuotationProvider.useState": ()=>{
            if ("TURBOPACK compile-time truthy", 1) {
                const stored = localStorage.getItem("currentCustomer");
                return stored ? JSON.parse(stored) : null;
            }
            //TURBOPACK unreachable
            ;
        }
    }["QuotationProvider.useState"]);
    const [currentProducts, setCurrentProductsState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "QuotationProvider.useState": ()=>{
            if ("TURBOPACK compile-time truthy", 1) {
                const stored = localStorage.getItem("currentProducts");
                return stored ? JSON.parse(stored) : null;
            }
            //TURBOPACK unreachable
            ;
        }
    }["QuotationProvider.useState"]);
    const [quotations, setQuotations] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    // Persist to localStorage when state changes
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "QuotationProvider.useEffect": ()=>{
            if (currentCustomer) {
                localStorage.setItem("currentCustomer", JSON.stringify(currentCustomer));
            } else {
                localStorage.removeItem("currentCustomer");
            }
        }
    }["QuotationProvider.useEffect"], [
        currentCustomer
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "QuotationProvider.useEffect": ()=>{
            if (currentProducts) {
                localStorage.setItem("currentProducts", JSON.stringify(currentProducts));
            } else {
                localStorage.removeItem("currentProducts");
            }
        }
    }["QuotationProvider.useEffect"], [
        currentProducts
    ]);
    const setCurrentCustomer = (customer)=>{
        setCurrentCustomerState(customer);
    };
    const setCurrentProducts = (products)=>{
        setCurrentProductsState(products);
    };
    const saveQuotation = (discount, totalAmount)=>{
        const dealerId = JSON.parse(localStorage.getItem("dealer") || "{}").id || "unknown";
        const finalAmount = totalAmount - totalAmount * discount / 100;
        const quotation = {
            id: `QT-${Date.now()}`,
            customer: currentCustomer,
            products: currentProducts,
            discount,
            totalAmount,
            finalAmount,
            createdAt: new Date().toISOString(),
            dealerId,
            status: "pending"
        };
        const existing = JSON.parse(localStorage.getItem("quotations") || "[]");
        existing.push(quotation);
        localStorage.setItem("quotations", JSON.stringify(existing));
        setQuotations(existing);
        return quotation;
    };
    const getQuotations = (dealerId)=>{
        const all = JSON.parse(localStorage.getItem("quotations") || "[]");
        return all.filter((q)=>q.dealerId === dealerId);
    };
    const clearCurrent = ()=>{
        setCurrentCustomerState(null);
        setCurrentProductsState(null);
        localStorage.removeItem("currentCustomer");
        localStorage.removeItem("currentProducts");
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(QuotationContext.Provider, {
        value: {
            currentCustomer,
            currentProducts,
            quotations,
            setCurrentCustomer,
            setCurrentProducts,
            saveQuotation,
            getQuotations,
            clearCurrent
        },
        children: children
    }, void 0, false, {
        fileName: "[project]/lib/quotation-context.tsx",
        lineNumber: 161,
        columnNumber: 5
    }, this);
}
_s(QuotationProvider, "GeO3vov7R5PC/z52/cU2fa6nSNs=");
_c = QuotationProvider;
function useQuotation() {
    _s1();
    const context = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(QuotationContext);
    if (!context) {
        throw new Error("useQuotation must be used within a QuotationProvider");
    }
    return context;
}
_s1(useQuotation, "b9L3QQ+jgeyIrH0NfHrJ8nn7VMU=");
var _c;
__turbopack_context__.k.register(_c, "QuotationProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/node_modules/next/navigation.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {

module.exports = __turbopack_context__.r("[project]/node_modules/next/dist/client/components/navigation.js [app-client] (ecmascript)");
}),
"[project]/node_modules/@vercel/analytics/dist/next/index.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Analytics",
    ()=>Analytics2
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
// src/nextjs/index.tsx
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
// src/nextjs/utils.ts
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
"use client";
;
;
// package.json
var name = "@vercel/analytics";
var version = "1.6.1";
// src/queue.ts
var initQueue = ()=>{
    if (window.va) return;
    window.va = function a(...params) {
        (window.vaq = window.vaq || []).push(params);
    };
};
// src/utils.ts
function isBrowser() {
    return typeof window !== "undefined";
}
function detectEnvironment() {
    try {
        const env = ("TURBOPACK compile-time value", "development");
        if ("TURBOPACK compile-time truthy", 1) {
            return "development";
        }
    } catch (e) {}
    return "production";
}
function setMode(mode = "auto") {
    if (mode === "auto") {
        window.vam = detectEnvironment();
        return;
    }
    window.vam = mode;
}
function getMode() {
    const mode = isBrowser() ? window.vam : detectEnvironment();
    return mode || "production";
}
function isDevelopment() {
    return getMode() === "development";
}
function computeRoute(pathname, pathParams) {
    if (!pathname || !pathParams) {
        return pathname;
    }
    let result = pathname;
    try {
        const entries = Object.entries(pathParams);
        for (const [key, value] of entries){
            if (!Array.isArray(value)) {
                const matcher = turnValueToRegExp(value);
                if (matcher.test(result)) {
                    result = result.replace(matcher, `/[${key}]`);
                }
            }
        }
        for (const [key, value] of entries){
            if (Array.isArray(value)) {
                const matcher = turnValueToRegExp(value.join("/"));
                if (matcher.test(result)) {
                    result = result.replace(matcher, `/[...${key}]`);
                }
            }
        }
        return result;
    } catch (e) {
        return pathname;
    }
}
function turnValueToRegExp(value) {
    return new RegExp(`/${escapeRegExp(value)}(?=[/?#]|$)`);
}
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function getScriptSrc(props) {
    if (props.scriptSrc) {
        return props.scriptSrc;
    }
    if (isDevelopment()) {
        return "https://va.vercel-scripts.com/v1/script.debug.js";
    }
    if (props.basePath) {
        return `${props.basePath}/insights/script.js`;
    }
    return "/_vercel/insights/script.js";
}
// src/generic.ts
function inject(props = {
    debug: true
}) {
    var _a;
    if (!isBrowser()) return;
    setMode(props.mode);
    initQueue();
    if (props.beforeSend) {
        (_a = window.va) == null ? void 0 : _a.call(window, "beforeSend", props.beforeSend);
    }
    const src = getScriptSrc(props);
    if (document.head.querySelector(`script[src*="${src}"]`)) return;
    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    script.dataset.sdkn = name + (props.framework ? `/${props.framework}` : "");
    script.dataset.sdkv = version;
    if (props.disableAutoTrack) {
        script.dataset.disableAutoTrack = "1";
    }
    if (props.endpoint) {
        script.dataset.endpoint = props.endpoint;
    } else if (props.basePath) {
        script.dataset.endpoint = `${props.basePath}/insights`;
    }
    if (props.dsn) {
        script.dataset.dsn = props.dsn;
    }
    script.onerror = ()=>{
        const errorMessage = isDevelopment() ? "Please check if any ad blockers are enabled and try again." : "Be sure to enable Web Analytics for your project and deploy again. See https://vercel.com/docs/analytics/quickstart for more information.";
        console.log(`[Vercel Web Analytics] Failed to load script from ${src}. ${errorMessage}`);
    };
    if (isDevelopment() && props.debug === false) {
        script.dataset.debug = "false";
    }
    document.head.appendChild(script);
}
function pageview({ route, path }) {
    var _a;
    (_a = window.va) == null ? void 0 : _a.call(window, "pageview", {
        route,
        path
    });
}
// src/react/utils.ts
function getBasePath() {
    if (typeof __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"] === "undefined" || typeof __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env === "undefined") {
        return void 0;
    }
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.REACT_APP_VERCEL_OBSERVABILITY_BASEPATH;
}
// src/react/index.tsx
function Analytics(props) {
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Analytics.useEffect": ()=>{
            var _a;
            if (props.beforeSend) {
                (_a = window.va) == null ? void 0 : _a.call(window, "beforeSend", props.beforeSend);
            }
        }
    }["Analytics.useEffect"], [
        props.beforeSend
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Analytics.useEffect": ()=>{
            inject({
                framework: props.framework || "react",
                basePath: props.basePath ?? getBasePath(),
                ...props.route !== void 0 && {
                    disableAutoTrack: true
                },
                ...props
            });
        }
    }["Analytics.useEffect"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Analytics.useEffect": ()=>{
            if (props.route && props.path) {
                pageview({
                    route: props.route,
                    path: props.path
                });
            }
        }
    }["Analytics.useEffect"], [
        props.route,
        props.path
    ]);
    return null;
}
;
var useRoute = ()=>{
    const params = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useParams"])();
    const searchParams = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSearchParams"])();
    const path = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"])();
    if (!params) {
        return {
            route: null,
            path
        };
    }
    const finalParams = Object.keys(params).length ? params : Object.fromEntries(searchParams.entries());
    return {
        route: computeRoute(path, finalParams),
        path
    };
};
function getBasePath2() {
    if (typeof __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"] === "undefined" || typeof __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env === "undefined") {
        return void 0;
    }
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_VERCEL_OBSERVABILITY_BASEPATH;
}
// src/nextjs/index.tsx
function AnalyticsComponent(props) {
    const { route, path } = useRoute();
    return /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(Analytics, {
        path,
        route,
        ...props,
        basePath: getBasePath2(),
        framework: "next"
    });
}
function Analytics2(props) {
    return /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Suspense"], {
        fallback: null
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(AnalyticsComponent, {
        ...props
    }));
}
;
 //# sourceMappingURL=index.mjs.map
}),
"[project]/node_modules/next/dist/compiled/react/cjs/react-jsx-dev-runtime.development.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/**
 * @license React
 * react-jsx-dev-runtime.development.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */ var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
"production" !== ("TURBOPACK compile-time value", "development") && function() {
    function getComponentNameFromType(type) {
        if (null == type) return null;
        if ("function" === typeof type) return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
        if ("string" === typeof type) return type;
        switch(type){
            case REACT_FRAGMENT_TYPE:
                return "Fragment";
            case REACT_PROFILER_TYPE:
                return "Profiler";
            case REACT_STRICT_MODE_TYPE:
                return "StrictMode";
            case REACT_SUSPENSE_TYPE:
                return "Suspense";
            case REACT_SUSPENSE_LIST_TYPE:
                return "SuspenseList";
            case REACT_ACTIVITY_TYPE:
                return "Activity";
            case REACT_VIEW_TRANSITION_TYPE:
                return "ViewTransition";
        }
        if ("object" === typeof type) switch("number" === typeof type.tag && console.error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), type.$$typeof){
            case REACT_PORTAL_TYPE:
                return "Portal";
            case REACT_CONTEXT_TYPE:
                return type.displayName || "Context";
            case REACT_CONSUMER_TYPE:
                return (type._context.displayName || "Context") + ".Consumer";
            case REACT_FORWARD_REF_TYPE:
                var innerType = type.render;
                type = type.displayName;
                type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
                return type;
            case REACT_MEMO_TYPE:
                return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
            case REACT_LAZY_TYPE:
                innerType = type._payload;
                type = type._init;
                try {
                    return getComponentNameFromType(type(innerType));
                } catch (x) {}
        }
        return null;
    }
    function testStringCoercion(value) {
        return "" + value;
    }
    function checkKeyStringCoercion(value) {
        try {
            testStringCoercion(value);
            var JSCompiler_inline_result = !1;
        } catch (e) {
            JSCompiler_inline_result = !0;
        }
        if (JSCompiler_inline_result) {
            JSCompiler_inline_result = console;
            var JSCompiler_temp_const = JSCompiler_inline_result.error;
            var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
            JSCompiler_temp_const.call(JSCompiler_inline_result, "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.", JSCompiler_inline_result$jscomp$0);
            return testStringCoercion(value);
        }
    }
    function getTaskName(type) {
        if (type === REACT_FRAGMENT_TYPE) return "<>";
        if ("object" === typeof type && null !== type && type.$$typeof === REACT_LAZY_TYPE) return "<...>";
        try {
            var name = getComponentNameFromType(type);
            return name ? "<" + name + ">" : "<...>";
        } catch (x) {
            return "<...>";
        }
    }
    function getOwner() {
        var dispatcher = ReactSharedInternals.A;
        return null === dispatcher ? null : dispatcher.getOwner();
    }
    function UnknownOwner() {
        return Error("react-stack-top-frame");
    }
    function hasValidKey(config) {
        if (hasOwnProperty.call(config, "key")) {
            var getter = Object.getOwnPropertyDescriptor(config, "key").get;
            if (getter && getter.isReactWarning) return !1;
        }
        return void 0 !== config.key;
    }
    function defineKeyPropWarningGetter(props, displayName) {
        function warnAboutAccessingKey() {
            specialPropKeyWarningShown || (specialPropKeyWarningShown = !0, console.error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)", displayName));
        }
        warnAboutAccessingKey.isReactWarning = !0;
        Object.defineProperty(props, "key", {
            get: warnAboutAccessingKey,
            configurable: !0
        });
    }
    function elementRefGetterWithDeprecationWarning() {
        var componentName = getComponentNameFromType(this.type);
        didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = !0, console.error("Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."));
        componentName = this.props.ref;
        return void 0 !== componentName ? componentName : null;
    }
    function ReactElement(type, key, props, owner, debugStack, debugTask) {
        var refProp = props.ref;
        type = {
            $$typeof: REACT_ELEMENT_TYPE,
            type: type,
            key: key,
            props: props,
            _owner: owner
        };
        null !== (void 0 !== refProp ? refProp : null) ? Object.defineProperty(type, "ref", {
            enumerable: !1,
            get: elementRefGetterWithDeprecationWarning
        }) : Object.defineProperty(type, "ref", {
            enumerable: !1,
            value: null
        });
        type._store = {};
        Object.defineProperty(type._store, "validated", {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: 0
        });
        Object.defineProperty(type, "_debugInfo", {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: null
        });
        Object.defineProperty(type, "_debugStack", {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: debugStack
        });
        Object.defineProperty(type, "_debugTask", {
            configurable: !1,
            enumerable: !1,
            writable: !0,
            value: debugTask
        });
        Object.freeze && (Object.freeze(type.props), Object.freeze(type));
        return type;
    }
    function jsxDEVImpl(type, config, maybeKey, isStaticChildren, debugStack, debugTask) {
        var children = config.children;
        if (void 0 !== children) if (isStaticChildren) if (isArrayImpl(children)) {
            for(isStaticChildren = 0; isStaticChildren < children.length; isStaticChildren++)validateChildKeys(children[isStaticChildren]);
            Object.freeze && Object.freeze(children);
        } else console.error("React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead.");
        else validateChildKeys(children);
        if (hasOwnProperty.call(config, "key")) {
            children = getComponentNameFromType(type);
            var keys = Object.keys(config).filter(function(k) {
                return "key" !== k;
            });
            isStaticChildren = 0 < keys.length ? "{key: someKey, " + keys.join(": ..., ") + ": ...}" : "{key: someKey}";
            didWarnAboutKeySpread[children + isStaticChildren] || (keys = 0 < keys.length ? "{" + keys.join(": ..., ") + ": ...}" : "{}", console.error('A props object containing a "key" prop is being spread into JSX:\n  let props = %s;\n  <%s {...props} />\nReact keys must be passed directly to JSX without using spread:\n  let props = %s;\n  <%s key={someKey} {...props} />', isStaticChildren, children, keys, children), didWarnAboutKeySpread[children + isStaticChildren] = !0);
        }
        children = null;
        void 0 !== maybeKey && (checkKeyStringCoercion(maybeKey), children = "" + maybeKey);
        hasValidKey(config) && (checkKeyStringCoercion(config.key), children = "" + config.key);
        if ("key" in config) {
            maybeKey = {};
            for(var propName in config)"key" !== propName && (maybeKey[propName] = config[propName]);
        } else maybeKey = config;
        children && defineKeyPropWarningGetter(maybeKey, "function" === typeof type ? type.displayName || type.name || "Unknown" : type);
        return ReactElement(type, children, maybeKey, getOwner(), debugStack, debugTask);
    }
    function validateChildKeys(node) {
        isValidElement(node) ? node._store && (node._store.validated = 1) : "object" === typeof node && null !== node && node.$$typeof === REACT_LAZY_TYPE && ("fulfilled" === node._payload.status ? isValidElement(node._payload.value) && node._payload.value._store && (node._payload.value._store.validated = 1) : node._store && (node._store.validated = 1));
    }
    function isValidElement(object) {
        return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
    }
    var React = __turbopack_context__.r("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"), REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = Symbol.for("react.activity"), REACT_VIEW_TRANSITION_TYPE = Symbol.for("react.view_transition"), REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference"), ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, hasOwnProperty = Object.prototype.hasOwnProperty, isArrayImpl = Array.isArray, createTask = console.createTask ? console.createTask : function() {
        return null;
    };
    React = {
        react_stack_bottom_frame: function(callStackForError) {
            return callStackForError();
        }
    };
    var specialPropKeyWarningShown;
    var didWarnAboutElementRef = {};
    var unknownOwnerDebugStack = React.react_stack_bottom_frame.bind(React, UnknownOwner)();
    var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
    var didWarnAboutKeySpread = {};
    exports.Fragment = REACT_FRAGMENT_TYPE;
    exports.jsxDEV = function(type, config, maybeKey, isStaticChildren) {
        var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
        if (trackActualOwner) {
            var previousStackTraceLimit = Error.stackTraceLimit;
            Error.stackTraceLimit = 10;
            var debugStackDEV = Error("react-stack-top-frame");
            Error.stackTraceLimit = previousStackTraceLimit;
        } else debugStackDEV = unknownOwnerDebugStack;
        return jsxDEVImpl(type, config, maybeKey, isStaticChildren, debugStackDEV, trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask);
    };
}();
}),
"[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
'use strict';
if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
;
else {
    module.exports = __turbopack_context__.r("[project]/node_modules/next/dist/compiled/react/cjs/react-jsx-dev-runtime.development.js [app-client] (ecmascript)");
}
}),
]);

//# sourceMappingURL=_3475b3da._.js.map
// Hand-written seed examples for the category classifier (see
// src/services/categorize.service.js and docs/decisions.md #23).
//
// This is a cold-start aid, not a benchmark dataset: a brand-new ledger has
// no labelled history to learn from, so the classifier starts from these and
// then gives the ledger's OWN transactions more weight as they accumulate.
// It's small, India-centric (the app's currency is INR), and written by
// hand — which is exactly why any accuracy measured on it must be reported
// with that caveat (docs/load-testing.md and the upgrades log do).
//
// Keep entries short and realistic — what someone types into a description
// or merchant box, not a full sentence.

const SEED = {
    // ─── Expenses ──────────────────────────────────────────────────────────
    food: [
        'swiggy dinner', 'zomato order', 'swiggy instamart groceries', 'bigbasket vegetables', 'blinkit groceries',
        'dominos pizza', 'mcdonalds burger', 'starbucks coffee', 'cafe coffee day', 'lunch at restaurant',
        'grocery store', 'dmart monthly groceries', 'milk and bread', 'biryani takeaway', 'tea and snacks',
        'kfc chicken bucket', 'subway sandwich', 'haldirams sweets', 'fruits and vegetables market', 'breakfast idli dosa',
        'restaurant bill family dinner', 'zepto delivery', 'bakery cake', 'ice cream parlour', 'office canteen lunch',
    ],
    transport: [
        'uber airport', 'ola cab ride', 'rapido bike taxi', 'metro card recharge', 'petrol pump fuel',
        'auto rickshaw fare', 'irctc train ticket', 'bus ticket', 'indigo flight ticket', 'fastag toll recharge',
        'parking fee', 'diesel', 'redbus booking', 'car service and repair', 'monthly bus pass',
        'uber ride to office', 'cab to railway station', 'bike petrol', 'air india flight', 'vehicle insurance renewal',
    ],
    housing: [
        'monthly house rent', 'landlord rent payment', 'apartment maintenance charges', 'society maintenance', 'home loan emi',
        'rent for flat', 'pg accommodation rent', 'property tax', 'plumber repair', 'furniture for bedroom',
        'house painting', 'security deposit flat', 'broker fee for flat', 'home repair carpenter', 'housing society dues',
    ],
    utilities: [
        'electricity bill', 'bescom power bill', 'water bill', 'jio recharge', 'airtel postpaid bill',
        'broadband internet bill', 'act fibernet', 'lpg gas cylinder', 'piped gas bill', 'dth tata play recharge',
        'mobile recharge', 'vi vodafone bill', 'wifi bill', 'gas cylinder refill', 'municipal water tax',
    ],
    healthcare: [
        'apollo pharmacy medicines', 'doctor consultation fee', 'hospital bill', 'dental checkup', 'diagnostic lab blood test',
        'medplus medicines', 'health insurance premium', 'eye checkup and glasses', 'netmeds order', 'physiotherapy session',
        'pharmacy tablets', 'practo appointment', 'gym membership', 'vaccination', 'clinic visit',
    ],
    entertainment: [
        'netflix subscription', 'spotify premium', 'amazon prime video', 'bookmyshow movie tickets', 'pvr cinemas',
        'disney hotstar', 'youtube premium', 'gaming steam purchase', 'concert tickets', 'weekend outing bowling',
        'inox movie night', 'playstation game', 'zee5 subscription', 'sony liv', 'amusement park entry',
    ],
    education: [
        'udemy course', 'college tuition fees', 'school fees', 'coursera subscription', 'books and stationery',
        'exam registration fee', 'coaching classes', 'byjus subscription', 'online course certification', 'textbooks',
        'library membership', 'unacademy plus', 'skill training workshop', 'university semester fee', 'kindle ebook',
    ],
    shopping: [
        'amazon order', 'flipkart purchase', 'myntra clothes', 'ajio shirt', 'nykaa cosmetics',
        'croma electronics', 'reliance digital laptop', 'shoes from decathlon', 'ikea home decor', 'lifestyle store shopping',
        'westside jeans', 'meesho order', 'apple store iphone', 'gift for friend online shopping', 'zara jacket',
    ],
    other_expense: [
        'atm cash withdrawal', 'bank service charges', 'donation to charity', 'miscellaneous expense', 'late fee penalty',
        'courier charges', 'haircut salon', 'laundry dry cleaning', 'passport renewal fee', 'notary charges',
    ],

    // ─── Income ────────────────────────────────────────────────────────────
    salary: [
        'monthly salary credited', 'salary from employer', 'payroll credit', 'company salary', 'salary for the month',
        'net pay credited', 'ctc monthly payout', 'salary deposit', 'wages from office', 'stipend from internship',
    ],
    freelance: [
        'freelance project payment', 'upwork payout', 'fiverr earnings', 'consulting fee client', 'client invoice paid',
        'contract work payment', 'design gig payment', 'freelancing website development', 'toptal payment', 'side project income',
    ],
    investment: [
        'mutual fund redemption', 'dividend from shares', 'fd interest credited', 'zerodha profit withdrawal', 'sip returns',
        'stock sale proceeds', 'bond interest', 'savings account interest', 'ppf interest', 'crypto sale gains',
    ],
    gift: [
        'birthday gift money', 'gift from parents', 'wedding gift cash', 'diwali gift received', 'festival bonus from relatives',
        'gift from friend', 'shagun received', 'anniversary gift money',
    ],
    other_income: [
        'income tax refund', 'cashback received', 'sold old phone', 'rental income from tenant', 'reimbursement from company',
        'refund for cancelled order', 'lottery prize', 'deposit returned',
    ],
};

module.exports = { SEED };

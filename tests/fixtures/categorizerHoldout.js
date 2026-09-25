// Held-out evaluation phrases for the category classifier — deliberately NOT
// in src/data/categorySeed.js, and written before the classifier was first
// run, so it can't have been tuned against. Includes typos, brand variants,
// and phrasings the seed doesn't contain verbatim.
//
// Still a small, hand-written, single-author set: treat the accuracy it
// yields as a smoke test of generalisation, not a benchmark.

module.exports = [
    { text: 'swigy lunch', type: 'expense', category: 'food' },
    { text: 'zomato gold dinner', type: 'expense', category: 'food' },
    { text: 'chai and samosa', type: 'expense', category: 'food' },
    { text: 'weekly vegetables', type: 'expense', category: 'food' },
    { text: 'pizza hut', type: 'expense', category: 'food' },
    { text: 'uber to office', type: 'expense', category: 'transport' },
    { text: 'ola outstation', type: 'expense', category: 'transport' },
    { text: 'petrol', type: 'expense', category: 'transport' },
    { text: 'train ticket to pune', type: 'expense', category: 'transport' },
    { text: 'flight booking', type: 'expense', category: 'transport' },
    { text: 'october rent', type: 'expense', category: 'housing' },
    { text: 'flat maintenance', type: 'expense', category: 'housing' },
    { text: 'home loan installment', type: 'expense', category: 'housing' },
    { text: 'electricity', type: 'expense', category: 'utilities' },
    { text: 'jio fiber', type: 'expense', category: 'utilities' },
    { text: 'gas cylinder', type: 'expense', category: 'utilities' },
    { text: 'airtel recharge', type: 'expense', category: 'utilities' },
    { text: 'pharmacy', type: 'expense', category: 'healthcare' },
    { text: 'doctor visit', type: 'expense', category: 'healthcare' },
    { text: 'hospital', type: 'expense', category: 'healthcare' },
    { text: 'netflix', type: 'expense', category: 'entertainment' },
    { text: 'movie tickets', type: 'expense', category: 'entertainment' },
    { text: 'spotify', type: 'expense', category: 'entertainment' },
    { text: 'online course fee', type: 'expense', category: 'education' },
    { text: 'school fee', type: 'expense', category: 'education' },
    { text: 'amazon shopping', type: 'expense', category: 'shopping' },
    { text: 'myntra order', type: 'expense', category: 'shopping' },
    { text: 'flipkart phone', type: 'expense', category: 'shopping' },
    { text: 'atm withdrawal', type: 'expense', category: 'other_expense' },
    { text: 'salary credited', type: 'income', category: 'salary' },
    { text: 'october salary', type: 'income', category: 'salary' },
    { text: 'upwork payment', type: 'income', category: 'freelance' },
    { text: 'client paid invoice', type: 'income', category: 'freelance' },
    { text: 'dividend', type: 'income', category: 'investment' },
    { text: 'mutual fund returns', type: 'income', category: 'investment' },
    { text: 'birthday gift', type: 'income', category: 'gift' },
    { text: 'tax refund', type: 'income', category: 'other_income' },
];

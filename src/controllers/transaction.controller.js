const transactionService = require('../services/transaction.service');
<<<<<<< HEAD
const categorizeService = require('../services/categorize.service');

const create = async (req, res) => {
  const { transaction, unusual } = await transactionService.createTransaction(req.body, req.user._id);
  res.status(201).json({ success: true, data: transaction, unusual });
};

=======

/**
 * @swagger
 * /transactions:
 *   post:
 *     summary: Create a transaction (admin only)
 *     tags: [Transactions]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, type, category]
 *             properties:
 *               amount:      { type: number, example: 5000 }
 *               type:        { type: string, enum: [income, expense] }
 *               category:    { type: string, example: salary }
 *               date:        { type: string, format: date }
 *               description: { type: string }
 *     responses:
 *       201: { description: Transaction created }
 *       403: { description: Forbidden - insufficient role }
 */
const create = async (req, res) => {
  const transaction = await transactionService.createTransaction(
    req.body, req.user._id, req
  );
  res.status(201).json({ success: true, data: transaction });
};

/**
 * @swagger
 * /transactions:
 *   get:
 *     summary: Get all transactions with filtering and pagination
 *     tags: [Transactions]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: type,      schema: { type: string, enum: [income, expense] } }
 *       - { in: query, name: category,  schema: { type: string } }
 *       - { in: query, name: startDate, schema: { type: string, format: date } }
 *       - { in: query, name: endDate,   schema: { type: string, format: date } }
 *       - { in: query, name: minAmount, schema: { type: number } }
 *       - { in: query, name: maxAmount, schema: { type: number } }
 *       - { in: query, name: page,      schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit,     schema: { type: integer, default: 20 } }
 *       - { in: query, name: sortBy,    schema: { type: string, default: date } }
 *       - { in: query, name: sortOrder, schema: { type: string, default: desc } }
 *     responses:
 *       200: { description: Paginated list of transactions }
 */
>>>>>>> f9910c6c266a8504cd2fb0f86a3803c761396bf5
const getAll = async (req, res) => {
  const result = await transactionService.getTransactions(req.query);
  res.status(200).json({ success: true, ...result });
};

<<<<<<< HEAD
=======
/**
 * @swagger
 * /transactions/{id}:
 *   get:
 *     summary: Get a transaction by ID
 *     tags: [Transactions]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Transaction object }
 *       404: { description: Not found }
 */
>>>>>>> f9910c6c266a8504cd2fb0f86a3803c761396bf5
const getOne = async (req, res) => {
  const transaction = await transactionService.getTransactionById(req.params.id);
  res.status(200).json({ success: true, data: transaction });
};

<<<<<<< HEAD
const update = async (req, res) => {
  const transaction = await transactionService.updateTransaction(req.params.id, req.body, req.user._id);
  res.status(200).json({ success: true, data: transaction });
};

const remove = async (req, res) => {
  const result = await transactionService.deleteTransaction(req.params.id, req.user._id);
  res.status(200).json({ success: true, ...result });
};

const suggestCategory = async (req, res) => {
  const data = await categorizeService.suggestCategory(req.body);
  res.status(200).json({ success: true, data });
};

module.exports = { create, getAll, getOne, update, remove, suggestCategory };
=======
/**
 * @swagger
 * /transactions/{id}:
 *   patch:
 *     summary: Update a transaction (admin only)
 *     tags: [Transactions]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:      { type: number }
 *               type:        { type: string }
 *               category:    { type: string }
 *               date:        { type: string }
 *               description: { type: string }
 *     responses:
 *       200: { description: Updated transaction }
 */
const update = async (req, res) => {
  const transaction = await transactionService.updateTransaction(
    req.params.id, req.body, req.user._id, req
  );
  res.status(200).json({ success: true, data: transaction });
};

/**
 * @swagger
 * /transactions/{id}:
 *   delete:
 *     summary: Soft delete a transaction (admin only)
 *     tags: [Transactions]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Transaction deleted }
 *       404: { description: Not found }
 */
const remove = async (req, res) => {
  const result = await transactionService.deleteTransaction(
    req.params.id, req.user._id, req
  );
  res.status(200).json({ success: true, data: result });
};

module.exports = { create, getAll, getOne, update, remove };
>>>>>>> f9910c6c266a8504cd2fb0f86a3803c761396bf5

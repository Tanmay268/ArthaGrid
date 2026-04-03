const ApiError = require('../utils/ApiError');

//uage: validate(schema) - validates req.body by default
//validate(schema, 'query') - validate req.query
const validate = (schema, target = 'body') => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[target], {
            abortEarly: false,  //collect all errors not just the first
            stripUnknown: true, //remove fields not in schema
        });

        if(error){
            const details = error.details.map(d => ({
                field: d.path.join('.'),
                message: d.message.replace(/['"]/g, ''),
            }));
            throw ApiError.badRequest('Validation failed', details);
        }

        req[target] = value; //replaced with sanitized value
        next();
    };
};

module.exports = validate;
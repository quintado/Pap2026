const { body, param, query, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            message: 'Erro de validação',
            errors: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    }
    next();
};

const validateLogin = [
    body('name')
        .trim()
        .notEmpty().withMessage('Nome de utilizador é obrigatório')
        .isLength({ min: 2, max: 100 }).withMessage('Nome deve ter entre 2 e 100 caracteres'),
    body('password')
        .notEmpty().withMessage('Palavra-passe é obrigatória')
        .isLength({ min: 6 }).withMessage('Palavra-passe deve ter no mínimo 6 caracteres'),
    handleValidationErrors
];

const validateRegister = [
    body('name')
        .trim()
        .notEmpty().withMessage('Nome de utilizador é obrigatório')
        .isLength({ min: 2, max: 100 }).withMessage('Nome deve ter entre 2 e 100 caracteres')
        .matches(/^[a-zA-Z0-9áéíóúàèìòùâêîôûãõäëïöüçÁÉÍÓÚÀÈÌÒÙÂÊÎÔÛÃÕÄËÏÖÜÇ\s]+$/)
        .withMessage('Nome contém caracteres inválidos'),
    body('password')
        .notEmpty().withMessage('Palavra-passe é obrigatória')
        .isLength({ min: 6 }).withMessage('Palavra-passe deve ter no mínimo 6 caracteres'),
    body('company')
        .trim()
        .notEmpty().withMessage('Nome da empresa é obrigatório')
        .isLength({ min: 2, max: 100 }).withMessage('Nome da empresa deve ter entre 2 e 100 caracteres'),
    handleValidationErrors
];

const validateTruck = [
    body('plate')
        .trim()
        .notEmpty().withMessage('Matrícula é obrigatória')
        .matches(/^[A-Z0-9]{2}-[A-Z0-9]{2}-[A-Z0-9]{2}$/i)
        .withMessage('Formato de matrícula inválido (XX-XX-XX)'),
    body('model')
        .trim()
        .notEmpty().withMessage('Modelo é obrigatório')
        .isLength({ min: 2, max: 100 }).withMessage('Modelo deve ter entre 2 e 100 caracteres'),
    body('mileage')
        .notEmpty().withMessage('Quilometragem é obrigatória')
        .isInt({ min: 0, max: 9999999 }).withMessage('Quilometragem inválida'),
    body('createdBy')
        .notEmpty().withMessage('ID do criador é obrigatório'),
    handleValidationErrors
];

const validateDelivery = [
    body('tipo')
        .trim()
        .notEmpty().withMessage('Tipo de entrega é obrigatório')
        .isIn(['Paletes', 'Documentos', 'Refrigerados', 'Frágeis', 'Outros']).withMessage('Tipo de entrega inválido'),
    body('origem')
        .trim()
        .notEmpty().withMessage('Origem é obrigatória')
        .isLength({ min: 2, max: 200 }).withMessage('Origem deve ter entre 2 e 200 caracteres'),
    body('destino')
        .trim()
        .notEmpty().withMessage('Destino é obrigatório')
        .isLength({ min: 2, max: 200 }).withMessage('Destino deve ter entre 2 e 200 caracteres'),
    body('estado')
        .trim()
        .notEmpty().withMessage('Estado é obrigatório')
        .isIn(['pendente', 'em-curso', 'concluido', 'cancelado']).withMessage('Estado inválido'),
    body('dataPrevista')
        .optional({ checkFalsy: true })
        .isISO8601().withMessage('Data prevista inválida'),
    body('observacoes')
        .optional()
        .trim()
        .isLength({ max: 1000 }).withMessage('Observações podem ter no máximo 1000 caracteres'),
    body('createdBy')
        .optional()
        .isInt().withMessage('ID do criador inválido'),
    body('updatedBy')
        .optional()
        .isInt().withMessage('ID do atualizador inválido'),
    handleValidationErrors
];

const validateUserCreation = [
    body('name')
        .trim()
        .notEmpty().withMessage('Nome é obrigatório')
        .isLength({ min: 2, max: 100 }).withMessage('Nome deve ter entre 2 e 100 caracteres'),
    body('password')
        .notEmpty().withMessage('Palavra-passe é obrigatória')
        .isLength({ min: 6 }).withMessage('Palavra-passe deve ter no mínimo 6 caracteres'),
    body('role')
        .notEmpty().withMessage('Função é obrigatória')
        .isIn(['fundador', 'supervisor', 'trabalhador']).withMessage('Função inválida'),
    body('createdBy')
        .notEmpty().withMessage('ID do criador é obrigatório')
        .isInt().withMessage('ID do criador inválido'),
    handleValidationErrors
];

const validateIDParam = (paramName = 'id') => [
    param(paramName).isInt().withMessage(`${paramName} inválido`),
    handleValidationErrors
];

module.exports = {
    validateLogin,
    validateRegister,
    validateTruck,
    validateDelivery,
    validateUserCreation,
    validateIDParam,
    handleValidationErrors
};

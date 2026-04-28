const Validators = {
    required: (value, fieldName = 'Campo') => {
        if (!value || value.trim() === '') {
            return { valid: false, message: `${fieldName} é obrigatório.` };
        }
        return { valid: true };
    },

    email: (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return { valid: false, message: 'Email inválido.' };
        }
        return { valid: true };
    },

    password: (password) => {
        if (password.length < 6) {
            return {
                valid: false,
                message: 'Palavra-passe deve ter no mínimo 6 caracteres.'
            };
        }
        return { valid: true };
    },

    strongPassword: (password) => {
        if (password.length < 8) {
            return {
                valid: false,
                message: 'Palavra-passe deve ter no mínimo 8 caracteres.'
            };
        }

        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumber = /[0-9]/.test(password);

        if (!hasUpperCase || !hasLowerCase || !hasNumber) {
            return {
                valid: false,
                message: 'Palavra-passe deve conter maiúsculas, minúsculas e números.'
            };
        }

        return { valid: true };
    },

    passwordMatch: (password, confirmPassword) => {
        if (password !== confirmPassword) {
            return {
                valid: false,
                message: 'As palavras-passe não coincidem.'
            };
        }
        return { valid: true };
    },

    licensePlate: (plate) => {
        const plateRegex = /^[A-Z]{2}-[0-9A-Z]{2}-[0-9A-Z]{2}$/i;

        if (!plateRegex.test(plate)) {
            return {
                valid: false,
                message: 'Matrícula inválida. Formato: XX-XX-XX'
            };
        }
        return { valid: true };
    },

    positiveNumber: (value, fieldName = 'Valor') => {
        const num = Number(value);
        if (isNaN(num) || num < 0) {
            return {
                valid: false,
                message: `${fieldName} deve ser um número positivo.`
            };
        }
        return { valid: true };
    },

    minLength: (value, min, fieldName = 'Campo') => {
        if (value.length < min) {
            return {
                valid: false,
                message: `${fieldName} deve ter no mínimo ${min} caracteres.`
            };
        }
        return { valid: true };
    },

    maxLength: (value, max, fieldName = 'Campo') => {
        if (value.length > max) {
            return {
                valid: false,
                message: `${fieldName} deve ter no máximo ${max} caracteres.`
            };
        }
        return { valid: true };
    },

    companyName: (name) => {
        if (name.length < 2) {
            return {
                valid: false,
                message: 'Nome da empresa muito curto.'
            };
        }
        if (name.length > 100) {
            return {
                valid: false,
                message: 'Nome da empresa muito longo.'
            };
        }
        return { valid: true };
    },

    mileage: (value) => {
        const km = Number(value);
        if (isNaN(km) || km < 0) {
            return {
                valid: false,
                message: 'Quilometragem inválida.'
            };
        }
        if (km > 9999999) {
            return {
                valid: false,
                message: 'Quilometragem muito alta.'
            };
        }
        return { valid: true };
    }
};

function showFieldError(inputElement, message) {
    inputElement.classList.add('input-error');

    const existingError = inputElement.parentElement.querySelector('.field-error-message');
    if (existingError) {
        existingError.remove();
    }

    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error-message';
    errorDiv.textContent = message;
    inputElement.parentElement.appendChild(errorDiv);
}

function clearFieldError(inputElement) {
    inputElement.classList.remove('input-error');
    const errorDiv = inputElement.parentElement.querySelector('.field-error-message');
    if (errorDiv) {
        errorDiv.remove();
    }
}

function showFieldSuccess(inputElement) {
    inputElement.classList.remove('input-error');
    inputElement.classList.add('input-success');
    clearFieldError(inputElement);
}

if (typeof window !== 'undefined') {
    window.Validators = Validators;
    window.showFieldError = showFieldError;
    window.clearFieldError = clearFieldError;
    window.showFieldSuccess = showFieldSuccess;
}

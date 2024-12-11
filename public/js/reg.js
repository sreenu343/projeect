  const passwordInput = document.getElementById('password');
        const submitButton = document.getElementById('submit-btn');
        const minLength = document.getElementById('min-length');
        const uppercase = document.getElementById('uppercase');
        const lowercase = document.getElementById('lowercase');
        const digit = document.getElementById('digit');
        const specialChar = document.getElementById('special-char');

        // Password validation rules
        const passwordValidationRules = {
            minLength: false,
            uppercase: false,
            lowercase: false,
            digit: false,
            specialChar: false
        };

        // Function to validate password
        passwordInput.addEventListener('input', function () {
            const password = passwordInput.value;

            // Show password validation
            document.querySelector('.password-validation').style.display = 'block';

            // Check minimum length
            if (password.length >= 8) {
                passwordValidationRules.minLength = true;
                minLength.classList.replace('invalid', 'valid');
            } else {
                passwordValidationRules.minLength = false;
                minLength.classList.replace('valid', 'invalid');
            }

            // Check for uppercase letter
            if (/[A-Z]/.test(password)) {
                passwordValidationRules.uppercase = true;
                uppercase.classList.replace('invalid', 'valid');
            } else {
                passwordValidationRules.uppercase = false;
                uppercase.classList.replace('valid', 'invalid');
            }

            // Check for lowercase letter
            if (/[a-z]/.test(password)) {
                passwordValidationRules.lowercase = true;
                lowercase.classList.replace('invalid', 'valid');
            } else {
                passwordValidationRules.lowercase = false;
                lowercase.classList.replace('valid', 'invalid');
            }

            // Check for digit
            if (/\d/.test(password)) {
                passwordValidationRules.digit = true;
                digit.classList.replace('invalid', 'valid');
            } else {
                passwordValidationRules.digit = false;
                digit.classList.replace('valid', 'invalid');
            }

            // Check for special character
            if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
                passwordValidationRules.specialChar = true;
                specialChar.classList.replace('invalid', 'valid');
            } else {
                passwordValidationRules.specialChar = false;
                specialChar.classList.replace('valid', 'invalid');
            }

            // Enable submit button if all rules are valid
            if (Object.values(passwordValidationRules).every(value => value)) {
                submitButton.disabled = false;
                submitButton.classList.add('active');
            } else {
                submitButton.disabled = true;
                submitButton.classList.remove('active');
            }
        });

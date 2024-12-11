// Import required modules
const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const crypto = require('crypto'); // Required for generating random passwords
const path = require('path'); // Required for file paths

// Initialize Express app
const app = express();
const port = 2000;
const sessionTimeout = 10 * 60 * 1000;
// Set view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'your-very-secret-session-key', // Hardcoded session secret
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,  // Set to 'true' when using HTTPS
        httpOnly: true,
        sameSite: 'strict',
        maxAge: sessionTimeout  // Session will expire after 30 minutes of inactivity
    }
}));

// Create a MySQL connection using hardcoded credentials
const db = mysql.createConnection({
    host: 'localhost', // Your MySQL host
    user: 'sreenu', // Your MySQL username
    password: 'Sreenu#343', // Your MySQL password
    database: 'cyrseafoods' // Your MySQL database name
});

// Connect to MySQL database
db.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err.message);
        process.exit(1);  // Exit if unable to connect to the database
    }
    console.log('Connected to MySQL database');
});

// Middleware to check session expiration
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        const currentTime = Date.now();

        // Check if the session has timed out (last access time)
        if (req.session.lastAccessTime && (currentTime - req.session.lastAccessTime) > sessionTimeout) {
            // Session has expired
            req.session.destroy((err) => {
                if (err) {
                    console.error('Error destroying session:', err);
                }
                res.redirect('/');  // Redirect to login page
            });
        } else {
            // Update the session's last access time
            req.session.lastAccessTime = currentTime;
            return next();
        }
    } else {
        // User is not authenticated
        return res.redirect('/');  // Redirect to login page
    }
}

// Route for root path (Display intro page)
app.get('/', (req, res) => {
    res.render('intro');  // Renders the 'intro.ejs' page
});

// Admin Login page (GET)
app.get('/admin_login', (req, res) => {
    res.render('admin_login');  // Render the login page
});

// Admin Login (POST)
app.post('/admin_login', (req, res) => {
    const { adminID, password } = req.body;

    if (!adminID || !password) {
        return res.status(400).send('Admin ID and Password are required');
    }

    db.execute('SELECT * FROM adminTable WHERE AdminID = ?', [adminID], (err, results) => {
        if (err) {
            console.error('Error executing query:', err);
            return res.status(500).send('Internal server error');
        }

        if (results.length === 0) {
            return res.send('AdminID or Admin password may be wrong!');
        }

        const user = results[0];

        bcrypt.compare(password, user.Password, (err, isMatch) => {
            if (err) {
                console.error('Error comparing passwords:', err);
                return res.status(500).send('Internal server error');
            }

            if (isMatch) {
                req.session.user = {
                    adminID: user.AdminID,
                    name: user.Name,
                    role: user.Role // Optional: Add role or other data if needed
                };

                // Set initial session lastAccessTime
                req.session.lastAccessTime = Date.now();

                res.redirect('/homePage');
            } else {
                res.send('AdminID or Admin password may be wrong!');
            }
        });
    });
});

// Home Page (Authenticated Route)
app.get('/homePage', isAuthenticated, (req, res) => {
    res.render('homePage');  // Render the home page after successful login
});


const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com', // or use any other service like 'smtp.ethereal.email' or a custom SMTP server
  auth: {
    user: 'madadhasreenu343@gmail.com', // Your email address
    pass: 'eeoz klez bwpt dnqk'   // Your email password (consider using environment variables for security)
  }
});

// Store OTP temporarily in memory for simplicity (can use a DB for persistence in real-world apps)
let generatedOtp = null;
let otpEmail = null;

// Route to render the registration form
app.get('/register',isAuthenticated, (req, res) => {
    res.render('register')
});

// Send OTP to the provided email
app.post('/send-otp', (req, res) => {
    const { email } = req.body;

    // Generate a random OTP (6 digit OTP)
    generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    otpEmail = email;

    // Send OTP via email
    const mailOptions = {
        from: 'madadhasreenu343@gmail.com',
        to: email,
        subject: 'Your OTP for Registration',
        text: `Your OTP for registration is: ${generatedOtp}. It is valid for a short time.`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return res.status(500).send({ message: 'Error sending OTP' });
        }
        res.json({ message: 'OTP sent to your email!' });
    });
});

// Handle form submission for registration
app.post('/register', isAuthenticated,(req, res) => {
    const { firstName, lastName, email, phoneNumber, DepartmentName, jobTitle, address, permission, otp } = req.body;

    // Check if the OTP entered matches the generated OTP
    if (otp !== generatedOtp) {
        return res.status(400).send('OTP you entered is incorrect');
    }

    // Validate email
    db.execute('SELECT * FROM Employees WHERE Email = ?', [email], (err, results) => {
        if (err) {
            return res.status(500).send('Error checking email');
        }

        if (results.length > 0) {
            return res.status(400).send('Email already in use');
        }

        // Generate a random temporary password
        const tempPassword = crypto.randomBytes(4).toString('hex');

        // Hash the temporary password
        bcrypt.hash(tempPassword, 10, (err, hashedPassword) => {
            if (err) {
                return res.status(500).send('Error generating hashed password');
            }

            const createdBy = req.session.user ? req.session.user.adminID : null; // Assuming session contains AdminID

            // Insert into the database
            db.execute(
                'INSERT INTO Employees (FirstName, LastName, Email, PhoneNumber, DepartmentName, JobTitle, Address, createdBy, Password, permission) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [firstName, lastName, email, phoneNumber, DepartmentName, jobTitle, address, createdBy, hashedPassword, permission],
                (err, results) => {
                    if (err) {
                        return res.status(500).send('Error inserting employee details into database');
                    }

                    const employeeID = results.insertId;

                    // Send email with the temporary password
                    const mailOptions = {
                        from: 'madadhasreenu343@gmail.com',
                        to: email,
                        subject: 'Your Temporary Password',
                        text: `Your Employee ID is: ${employeeID}\nYour temporary password is: ${tempPassword}\n\nJob Title: ${jobTitle}\nDepartment: ${DepartmentName}\nAddress: ${address}`
                    };

                    transporter.sendMail(mailOptions, (error, info) => {
                        if (error) {
                            return res.status(500).send('Error sending email');
                        }
                        res.redirect('/homePage');
                    });
                }
            );
        });
    });
});

// Route to display employee data
app.get('/display', isAuthenticated,(req, res) => {
  // Query to fetch all employees
  const query = 'SELECT * FROM employees';
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching employee data:', err);
      return res.status(500).send('Error fetching data');
    }

    // Format the dates before rendering the page
    results.forEach(employee => {
      if (employee.DateOfJoining) {
        employee.DateOfJoining = formatDate(employee.DateOfJoining);
      }
      if (employee.DateOfLeave) {
        employee.DateOfLeave = formatDate(employee.DateOfLeave);
      }
 if (employee.UpdatedAt) {
        employee.UpdatedAt = formatDate(employee.UpdatedAt);
      }

    });

    // Render the 'display.ejs' page and pass the employee data
    res.render('display', { employees: results });
  });
});

// Helper function to format date as dd/mm/yyyy
function formatDate(date) {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// Admin Profile View Route
app.get('/mview', isAuthenticated, (req, res) => {
    const adminID = req.session.user.adminID; // Get logged-in admin ID from session

    // Fetch admin details from the database
    db.execute('SELECT adminID, FirstName, LastName, PhoneNumber, JobTitle, DepartmentName, Email, Address, UpdatedAt FROM adminTable WHERE adminID = ?', [adminID], (err, results) => {
        if (err) {
            console.error('Error fetching admin details:', err);
            return res.status(500).send('Error fetching admin details');
        }

        if (results.length === 0) {
            console.error('Admin not found');
            return res.status(404).send('Admin not found');
        }

        // Pass admin data to the EJS template
        res.render('mview', { admin: results[0] }); // Render the 'mview.ejs' template with admin data
    });
});

// GET route for password change page (admin must be authenticated)
app.get('/apswrdc', isAuthenticated,(req, res) => {
    if (!req.session || !req.session.user || !req.session.user.adminID) {
        return res.status(401).send('Unauthorized');
    }
    res.render('apswrdc');
});

// POST route for processing password change
app.post('/apswrdc',isAuthenticated, (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const adminID = req.session.user.adminID;

    // Check if all required fields are present
    if (!oldPassword || !newPassword || !adminID) {
        return res.status(400).send('Old password, new password, and admin ID are required');
    }

    // 2. Fetch the current password (hashed) from the database
    db.execute('SELECT Password FROM adminTable WHERE adminID = ?', [adminID], (err, results) => {
        if (err) {
            console.error('Error fetching admin data:', err);
            return res.status(500).send('Error fetching admin data.');
        }

        if (results.length === 0) {
            return res.status(404).send('Admin not found.');
        }

        // 3. Compare the old password with the stored hashed password
        bcrypt.compare(oldPassword, results[0].Password, (compareErr, isMatch) => {
            if (compareErr) {
                console.error('Error comparing passwords:', compareErr);
                return res.status(500).send('Error comparing passwords.');
            }

            if (!isMatch) {
                return res.status(400).send('Old password is incorrect.');
            }

            // 4. Hash the new password before updating
            bcrypt.hash(newPassword, 10, (hashErr, hashedNewPassword) => {
                if (hashErr) {
                    console.error('Error hashing new password:', hashErr);
                    return res.status(500).send('Error hashing new password.');
                }

                // 5. Update the password in the database
                db.execute('UPDATE adminTable SET Password = ? WHERE adminID = ?', [hashedNewPassword, adminID], (updateErr) => {
                    if (updateErr) {
                        console.error('Error updating password:', updateErr);
                        return res.status(500).send('Error updating password.');
                    }

                    // 6. Send success response
                    res.send('Password updated successfully.');
                });
            });
        });
    });
});

app.get('/harvest', isAuthenticated, (req, res) => {
    // Query the database for harvest data
    db.query('SELECT * FROM purchase', (err, results) => {
        if (err) {
            console.error('Error fetching harvest data:', err);
            return res.status(500).send('Error fetching data');
        }

        // Format the dates in the results
        results.forEach(harvest => {
            if (harvest.billdate ) {
                harvest.billdate  = formatDate(harvest.billdate );  // Format entrydate
            }
            if (harvest.paymentdate ) {
                harvest.paymentdate  = formatDate(harvest.paymentdate);  // Format updatedat
            }
if (harvest.paymentdate2 ) {
                harvest.paymentdate2  = formatDate(harvest.paymentdate2);  // Format updatedat
            }
        });

        // Render the page with the fetched and formatted data
        res.render('harvest', { harvest: results });
    });
});

// Handle POST request to insert harvest data into the database
app.post('/harvest', (req, res) => {
  // Extract values from the form submitted
  const {
    BillNo, BillDate, Agent, Grader, Supervisor, Batch, VehicleNo, Boxes, Count,
    Weight, Rate, SoftVibRol_sNecros, Weight2,Rate2, CmRateperKG, RMPAID, Details, PaymentDate, RMAmountDebitedFrom, CMPAID, Details2,
    PaymentDate2, CMAmountDebitedFrom, Advances
  } = req.body;

const  FWeight= parseFloat(Weight);
const FWeight2 = parseFloat(Weight2);
const FRate=parseFloat(Rate);
const FRate2=parseFloat(Rate2);
const RMTOTAL = Math.round((FWeight * FRate) + (FWeight2 * FRate2));
const CMTOTAL= Math.round((FWeight + FWeight2) * CmRateperKG);
const RMCMTOTAL=RMTOTAL+CMTOTAL;
const BalanceRMPayment=RMTOTAL- RMPAID;
const BalanceCMPayment=CMTOTAL- CMPAID;
const PurchaseExpences=Math.round((FWeight + FWeight2) * 5);
const GrandTotal = RMCMTOTAL+PurchaseExpences;

  // Prepare the SQL query to insert data into the 'harvest' table
  const query = `INSERT INTO purchase (billno, billdate, agent, grader, supervisor, batch, vehicleno, boxes, count, weight, rate, soft, weight2, rate2, cmrateperkg, rmtotal, cmtotal, rmcmtotal, rmpaid, details, paymentdate, rmamountdebitedfrom, cmpaid, details2, paymentdate2, cmamountdebitedfrom, balancermpayment, balancecmpayment, purchesexpences, grandtotal, advances)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  // Values to insert
  const values = [
    BillNo, BillDate, Agent, Grader, Supervisor, Batch, VehicleNo, Boxes, Count,
    Weight, Rate, SoftVibRol_sNecros, Weight2, Rate2, CmRateperKG, RMTOTAL, CMTOTAL,
    RMCMTOTAL, RMPAID, Details, PaymentDate, RMAmountDebitedFrom, CMPAID, Details2,
    PaymentDate2, CMAmountDebitedFrom, BalanceRMPayment, BalanceCMPayment, PurchaseExpences,
    GrandTotal, Advances
  ];

  // Execute the query
  db.query(query, values, (err, result) => {
    if (err) {
      console.error('Error inserting data:', err);
      res.status(500).send('Error inserting data');
    } else {
      res.redirect('/harvest');  // Redirect to home page or show a success message
    }
  });
});

// Handle POST request to update purchase data into the database
app.post('/edit-harvest', (req, res) => {
  // Extract values from the form submitted
  const {
    BillNoo, BillDatee, Agentt, Graderr, Supervisorr, Batchh, VehicleNoo, Boxess, Countt,
    Weightt, Ratee, SoftVibRol_sNecross, Weight22,Rate22, CmRateperKGg, RMPAIDd, Detailss, PaymentDatee, RMAmountDebitedFromm, CMPAIDd, Details22,
    PaymentDate22, CMAmountDebitedFromm, Advancess
  } = req.body;

const  FWeight= parseFloat(Weightt);
const FWeight2 = parseFloat(Weight22);
const FRate=parseFloat(Ratee);
const FRate2=parseFloat(Rate22);
const RMTOTAL = Math.round((FWeight * FRate) + (FWeight2 * FRate2));
const CMTOTAL= Math.round((FWeight + FWeight2) * CmRateperKGg);
const RMCMTOTAL=RMTOTAL+CMTOTAL;
const BalanceRMPayment=RMTOTAL- RMPAIDd;
const BalanceCMPayment=CMTOTAL- CMPAIDd;
const PurchaseExpences=Math.round((FWeight + FWeight2) * 5);
const GrandTotal = RMCMTOTAL+PurchaseExpences;

  // Prepare the SQL query to update data in the 'purchase' table
const query = `
  UPDATE purchase SET
    billdate = ?, agent = ?, grader = ?, supervisor = ?, batch = ?, vehicleno = ?, 
    boxes = ?, count = ?, weight = ?, rate = ?, soft = ?, weight2 = ?, rate2 = ?, 
    cmrateperkg = ?, rmtotal = ?, cmtotal = ?, rmcmtotal = ?, rmpaid = ?, details = ?, 
    paymentdate = ?, rmamountdebitedfrom = ?, cmpaid = ?, details2 = ?, paymentdate2 = ?, 
    cmamountdebitedfrom = ?, balancermpayment = ?, balancecmpayment = ?, purchesexpences = ?, 
    grandtotal = ?, advances = ?
  WHERE billno = ?;
`;

// Values to update
const values = [
  BillDatee, Agentt, Graderr, Supervisorr, Batchh, VehicleNoo, Boxess, Countt,
  Weightt, Ratee, SoftVibRol_sNecross, Weight22, Rate22, CmRateperKGg, RMTOTAL, CMTOTAL,
  RMCMTOTAL, RMPAIDd, Detailss, PaymentDatee, RMAmountDebitedFromm, CMPAIDd, Details22,
  PaymentDate22, CMAmountDebitedFromm, BalanceRMPayment, BalanceCMPayment, PurchaseExpences,
  GrandTotal, Advancess, BillNoo // The BillNo is used to identify the record to update
];


  // Execute the query
  db.query(query, values, (err, result) => {
    if (err) {
      console.error('Error inserting data:', err);
      res.status(500).send('Error in updating data');
    } else {
      res.redirect('/harvest');  // Redirect to home page or show a success message
    }
  });
});

app.post('/deleteharvest/:billno', isAuthenticated, (req, res) => {
    const billno = req.params.billno;

    // SQL query to delete the record
    const deleteQuery = 'DELETE FROM harvest WHERE BillNo = ?';

    db.query(deleteQuery, [billno], (err, result) => {
        if (err) {
            console.error('Error deleting record:', err);
            return res.status(500).send('Error deleting record');
        }

        // Send a success response back
        if (result.affectedRows > 0) {
            res.status(200).send('Record deleted successfully');
        } else {
            res.status(404).send('Record not found');
        }
    });
});


app.get('/updateuser/:id', isAuthenticated,(req, res) => {
    const employeeID = req.params.id;

    // Query to fetch the employee data based on the EmployeeID
    const query = 'SELECT * FROM employees WHERE EmployeeID = ?';
    db.query(query, [employeeID], (err, results) => {
        if (err) {
            console.error('Error fetching employee data for update:', err);
            return res.status(500).send('Error fetching data');
        }
        
        // If employee not found
        if (results.length === 0) {
            return res.status(404).send('Employee not found');
        }

        // Send the employee data to the update form
        res.render('updateuser', { employee: results[0] });
    });
});
app.post('/updateuser/:id',isAuthenticated, (req, res) => {
    const employeeID = req.params.id;
    const { FirstName, LastName, Email, PhoneNumber, DateOfLeave, DepartmentName, JobTitle, Salary, Address, Status, leaveCheckbox } = req.body;

    // If the checkbox is not checked, do not update DateOfLeave
    // If the checkbox is checked, update DateOfLeave to the new value
    const leaveDate = leaveCheckbox ? DateOfLeave : null;

    // Retrieve current employee data first to retain original value of DateOfLeave if not updated
    const selectQuery = 'SELECT * FROM employees WHERE EmployeeID = ?';
    
    db.query(selectQuery, [employeeID], (err, result) => {
        if (err) {
            console.error('Error fetching employee data:', err);
            return res.status(500).send('Error fetching data');
        }

        // Get current DateOfLeave if no new date is provided (checkbox unchecked)
        const currentLeaveDate = result[0].DateOfLeave;

        // If checkbox is unchecked, use current DateOfLeave as it is
        const finalLeaveDate = leaveCheckbox ? leaveDate : currentLeaveDate;

        // SQL query to update employee data
        const query = `
            UPDATE employees SET
                FirstName = ?, LastName = ?, Email = ?, PhoneNumber = ?, DateOfLeave = ?, 
                DepartmentName = ?, JobTitle = ?, salary = ?, Address = ?, Status = ?
            WHERE EmployeeID = ?
        `;
        
        db.query(query, [FirstName, LastName, Email, PhoneNumber, finalLeaveDate, DepartmentName, JobTitle, Salary, Address, Status, employeeID], (err, result) => {
            if (err) {
                console.error('Error updating employee data:', err);
                return res.status(500).send('Error updating data');
            }

            // Redirect back to the employee list page after updating
            res.redirect('/display');
        });
    });
});

// Route to display the form
app.get('/cpswd', isAuthenticated,(req, res) => {
    res.render('cpswd');  // renders the cpswd.ejs page
});

// Route to handle the form submission (POST)
app.post('/cpswd', isAuthenticated,(req, res) => {
    const { EmployeeID, val } = req.body;  // Get the submitted form data

    if (!EmployeeID || !val) {
        return res.status(400).send('Employee ID and value are required');
    }

    // Step 1: Check if the EmployeeID exists in the database
    const checkQuery = 'SELECT * FROM employees WHERE EmployeeID = ?';
    db.query(checkQuery, [EmployeeID], (err, result) => {
        if (err) {
            console.error('Error checking employee ID:', err);
            return res.status(500).send('Error checking employee ID');
        }

        // Step 2: If no result is found for the given EmployeeID
        if (result.length === 0) {
            return res.status(404).send('Employee ID not found');
        }

        // Step 3: If EmployeeID exists, proceed to update
        const updateQuery = 'UPDATE employees SET Flag = ? WHERE EmployeeID = ?';
        db.query(updateQuery, [val, EmployeeID], (err, updateResult) => {
            if (err) {
                console.error('Error updating employee flag:', err);
                return res.status(500).send('Error updating employee flag');
            }

            if (updateResult.affectedRows > 0) {
                // Successfully updated, redirect to success page or employee details
                res.redirect('/display');
            } else {
                // If no rows were updated (unlikely if ID is correct), handle it gracefully
                res.status(500).send('No update made to the employee');
            }
        });
    });
});




app.get('/dis', (req, res) => {
    // Query the database for harvest data
    db.query('SELECT * FROM employees', (err, results) => {
        if (err) {
            console.error('Error fetching harvest data:', err);
            return res.status(500).send('Error fetching data');
        }
// Format the dates before rendering the page
    results.forEach(employee => {
      if (employee.DateOfJoining) {
        employee.DateOfJoining = formatDate(employee.DateOfJoining);
      }
      if (employee.DateOfLeave) {
        employee.DateOfLeave = formatDate(employee.DateOfLeave);
      }
 if (employee.UpdatedAt) {
        employee.UpdatedAt = formatDate(employee.UpdatedAt);
      }
    });

        // Render the page with the fetched data
        res.render('dis', { dis: results });
    });
});

app.post('/update-dis', (req, res) => {
    const { EmployeeID, FirstName, LastName, Email, PhoneNumber, DateOfJoining, DateOfLeave, DepartmentName, JobTitle, Salary, Address, Permission } = req.body;

    // Update logic here
    db.query(
        `UPDATE employees SET 
            FirstName = ?, 
            LastName = ?, 
            Email = ?, 
            PhoneNumber = ?, 
            DateOfJoining = ?, 
            DateOfLeave = ?, 
            DepartmentName = ?, 
            JobTitle = ?, 
            salary = ?, 
            Address = ?,  
            permission = ? 
        WHERE EmployeeID = ?`, 
        [FirstName, LastName, Email, PhoneNumber, DateOfJoining, DateOfLeave, DepartmentName, JobTitle, Salary, Address, Permission, EmployeeID],
        (err, result) => {
            if (err) throw err;
            // Redirect back to the employees list after updating
            res.redirect('/dis');
        }
    );
});



//.............................................................................................................................................................................................................

// Middleware to check session expiration
function isAuthenticatedE(req, res, next)
{
    	if (req.session.user)
	{
        	const currentTime = Date.now();

       		// Check if the session has timed out (last access time)
        	if (req.session.lastAccessTime && (currentTime - req.session.lastAccessTime) > sessionTimeout)
		{
           		 // Session has expired
           	 	req.session.destroy((err) =>
			{
               	 	if (err) {
                    	console.error('Error destroying session:', err);
                	}
               		 res.redirect('/');  // Redirect to login page
           	 	});
       		 }
		 else {
           	 	// Update the session's last access time
           	 	req.session.lastAccessTime = currentTime;
           		 return next();
       	 	}	
   	  }
	   else {
       		 // User is not authenticated
      		  return res.redirect('/');  // Redirect to login page
   		 }
}


//employee
// Employee Login Route
app.get('/employee_login', (req, res) => {
    res.render('employee_login'); 
});
app.get('/ehomePage',isAuthenticatedE, (req, res) => {
    res.render('ehomePage');  // Render the employee login page (employee_login.ejs)
});

// Handle form submission for employee login (POST /employee_login)
app.post('/employee_login', (req, res) => {
    const { employeeID, password } = req.body;  // Get EmployeeID and password from the form

    if (!employeeID || !password) {
        return res.status(400).send('Employee ID and Password are required');
    }

    // Query the Employees table to find the user by EmployeeID
    db.execute('SELECT * FROM Employees WHERE EmployeeID = ?', [employeeID], (err, results) => {
        if (err) {
            return res.status(500).send('Error in database query');
        }

        if (results.length === 0) {
            return res.send('Invalid Employee ID!');
        }

        const user = results[0];  // Get the first user matching the EmployeeID

        // Compare the entered password with the hashed password from the database
        bcrypt.compare(password, user.Password, (err, isMatch) => {
            if (err) {
                return res.status(500).send('Error comparing password');
            }

            if (isMatch) {
                req.session.user = user;  // Save user data in session
                res.redirect('/ehomePage');  // Redirect to employee profile page
            } else {
                res.send('Invalid password!');
            }
        });
    });
});

// Employee Profile View Route
app.get('/eview', isAuthenticatedE, (req, res) => {
    const employeeID = req.session.user.EmployeeID; // Get logged-in employee ID from session

    // Fetch employee details from the database
    db.execute('SELECT EmployeeID, FirstName, LastName, PhoneNumber, JobTitle, DepartmentName, Email, Address, UpdatedAt FROM Employees WHERE EmployeeID = ?', [employeeID], (err, results) => {
        if (err) {
            console.error('Error fetching employee details:', err);
            return res.status(500).send('Error fetching employee details');
        }

        if (results.length === 0) {
            console.error('Employee not found');
            return res.status(404).send('Employee not found');
        }

        // Pass employee data to the EJS template
        res.render('eview', { employee: results[0] });
    });
});





app.get('/ecreate', isAuthenticatedE, (req, res) => {
    // Check if the user has admin permission
    if (req.session.user && req.session.user.permission !== 'Admin') {
        return res.status(403).send("You don't have permission to create employees.");
    }
    res.render('ecreate');
});

// Route to send OTP
app.post('/send-otp', (req, res) => {
    const { email } = req.body;

    // Generate a random OTP (6 digits)
    generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // Send OTP via email
    const mailOptions = {
        from: 'madadhasreenu343@gmail.com', // Make sure to use the correct sender email
        to: email,
        subject: 'Your OTP for Registration',
        text: `Your OTP for registration is: ${generatedOtp}. It is valid for a short time.`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending OTP:', error); // Log the error for debugging
            return res.status(500).send('Error sending OTP');
        }
        res.json({ message: 'OTP sent to your email!' });
    });
});

// Handle employee creation form submission
app.post('/ecreate', isAuthenticatedE, (req, res) => {
    const { firstName, lastName, email, phoneNumber, DepartmentName, jobTitle, address, otp } = req.body;

    // Validate OTP
    if (otp !== generatedOtp) {
        return res.status(400).send('The OTP you entered is incorrect.');
    }

    // Check if email already exists
    db.execute('SELECT * FROM Employees WHERE Email = ?', [email], (err, results) => {
        if (err) {
            console.error('Error checking email:', err); // Log the error for debugging
            return res.status(500).send('Error checking email');
        }

        if (results.length > 0) {
            return res.status(400).send('Email already in use');
        }

        // Generate a temporary password for the new employee
        const tempPassword = crypto.randomBytes(4).toString('hex');

        // Hash the temporary password
        bcrypt.hash(tempPassword, 10, (err, hashedPassword) => {
            if (err) {
                console.error('Error generating hashed password:', err); // Log the error for debugging
                return res.status(500).send('Error generating hashed password');
            }

            // Get the employee ID of the user creating the new employee
            const createdByy = req.session.user ? req.session.user.EmployeeID : null;

            // Insert the new employee into the database
            db.execute(
                'INSERT INTO Employees (FirstName, LastName, Email, PhoneNumber, DepartmentName, JobTitle, Address, CreatedBy, Password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [firstName, lastName, email, phoneNumber, DepartmentName, jobTitle, address, createdByy, hashedPassword],
                (err, results) => {
                    if (err) {
                        console.error('Error inserting employee details into database:', err); // Log the error for debugging
                        return res.status(500).send('Error inserting employee details into database');
                    }

                    const employeeID = results.insertId;

                    // Send the employee email with the temporary password
                    const mailOptions = {
                        from: 'madadhasreenu343@gmail.com',
                        to: email,
                        subject: 'Your Temporary Password',
                        text: `Your Employee ID is: ${employeeID}\nYour temporary password is: ${tempPassword}\n\nJob Title: ${jobTitle}\nDepartment: ${DepartmentName}\nAddress: ${address}`
                    };

                    transporter.sendMail(mailOptions, (error, info) => {
                        if (error) {
                            console.error('Error sending employee email:', error); // Log the error for debugging
                            return res.status(500).send('Error sending email');
                        }

                        // Redirect to login after successful creation
                        res.redirect('/employee_login');
                    });
                }
            );
        });
    });
});


//...................................................................................................
app.get('/preq', isAuthenticatedE,(req, res) => {
    // Check if the session is valid and user is logged in
    if (!req.session || !req.session.user || !req.session.user.EmployeeID) {
        return res.status(401).send('Unauthorized');
    }

    const employeeID = req.session.user.EmployeeID;

    // Fetch employee's flag from the database
    db.execute('SELECT Flag FROM Employees WHERE EmployeeID = ?', [employeeID], (err, results) => {
        if (err) {
            console.error('Error fetching employee details:', err);
            return res.status(500).send('Error fetching employee details');
        }

        if (results.length === 0) {
            console.error('Employee not found');
            return res.status(404).send('Employee not found');
        }

        let flagg = results[0].Flag; // Access the Flag value from the query result

        // Check the flag value
        if (flagg <= 2) {

            // If flag is 0, render the password change form
            res.render('preq', { employeeID }); // You can pass the employeeID if needed in the view
        } else {
            // If flag is not 0, prompt the user to contact admin
            res.send('Please contact admin to change your password.');
        }
    });
});


app.post('/preq', isAuthenticatedE,(req, res) => {
    const { oldPassword, newPassword } = req.body;
    const employeeID = req.session.user.EmployeeID; // Assuming the user is logged in



    // 2. Fetch the current password (hashed) from the database for the logged-in employee
    db.execute('SELECT Password, Flag FROM Employees WHERE EmployeeID = ?', [employeeID], (err, results) => {
        if (err) {
            console.error('Error fetching employee data:', err);
            return res.status(500).send('Error fetching employee data.');
        }

        if (results.length === 0) {
            return res.status(404).send('Employee not found.');
        }

        const currentHashedPassword = results[0].Password; // The stored hashed password
        let flag = results[0].Flag; // The flag to check if password needs change (flag = 1)

        // 3. Compare the old password with the stored hashed password
        bcrypt.compare(oldPassword, currentHashedPassword, (compareErr, isMatch) => {
            if (compareErr) {
                console.error('Error comparing passwords:', compareErr);
                return res.status(500).send('Error comparing passwords.');
            }

            if (!isMatch) {
                return res.status(400).send('Old password is incorrect.');
            }

            // 4. Hash the new password before updating
            bcrypt.hash(newPassword, 10, (hashErr, hashedNewPassword) => {
                if (hashErr) {
                    console.error('Error hashing new password:', hashErr);
                    return res.status(500).send('Error hashing new password.');
                }
flag += 1;
                // 5. Update the password and set the flag to 1
                db.execute('UPDATE Employees SET Password = ?, Flag = ? WHERE EmployeeID = ?', [hashedNewPassword,flag, employeeID], (updateErr) => {
                    if (updateErr) {
                        console.error('Error updating password:', updateErr);
                        return res.status(500).send('Error updating password.');
                    }

                    // 6. Send success response
                    res.send('Password updated successfully.');
                });
            });
        });
    });
});
//.................................................................................................

//..................................................................................................................
// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Error logging out');
        }
        res.redirect('/');  // Redirect to home page after logout
    });
});

// Start server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

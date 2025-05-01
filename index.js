import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import session from "express-session";
import dotenv from "dotenv";

dotenv.config();


const app = express();
const PORT = process.env.PORT || 3000;
const saltRounds = 10;

let db;
if (process.env.DATABASE_URL) {
  db = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
} else {
    const db = new pg.Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
      });
      
}
db.connect();


app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static("public"));

app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true
}));

let userLoggedIn = false;

app.get("/", (req, res) => {
    userLoggedIn = req.session.userId ? true : false;
    res.render("home", { userLoggedIn });
});

app.get("/register", (req, res) => {
    res.render("register");
});

app.post("/register", async (req, res) => {
    const name = req.body.name;
    const email = req.body.email;
    const password = req.body.password;
    const confirmPassword = req.body.confirmPassword;

    try {
        const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [email]);

        if (checkResult.rows.length > 0) {
            res.send("Email already exists. Try logging in.");
        } else {
            if(password === confirmPassword){
                bcrypt.hash(password, saltRounds,async function(err, hash) {
                    const result = await db.query(
                        "INSERT INTO users (name, email, password) VALUES ($1, $2, $3)",
                        [name, email, hash]
                    );
                    console.log(hash);
                });
                res.redirect("/login");
            } else {
                res.send("Password and Confirm Password do not match.");
            }
        }
    } catch (err) {
        console.log(err);
        res.send("Error during registration.");
    }
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.post("/login", async (req, res) => {
    const email = req.body.email;
    const password = req.body.password;

    try {
        const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            const storedPassword = user.password;

            bcrypt.compare(password, storedPassword, async function (err, isMatch) {
                if (isMatch) {
                    req.session.userId = user.id;
                    res.redirect("/");
                } else {
                    res.send("Incorrect Password");
                }
            });
        } else {
            res.send("User not found");
        }
    } catch (err) {
        console.log(err);
        res.send("Error during login.");
    }
});

app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/");
});

app.get("/donate", (req, res) => {
    if (req.session.userId) {
        res.render("donate", { userLoggedIn: true });
    } else {
        res.redirect("/login");
    }
});

app.post("/donate-food", async (req, res) => {
    if (!req.session.userId) {
        return res.redirect("/login");
    }

    const userId = req.session.userId;
    const foodItem = req.body['food-item'];
    const customFood = req.body['custom-food'];

    if (foodItem === 'Others' && customFood) {
        console.log(`Custom Food Donation: ${customFood}`);
    } else {
        console.log(`Selected Food Item: ${foodItem}`);
    }

    try {
        await db.query(
            "INSERT INTO donations (user_id, donation_type, food_item) VALUES ($1, $2, $3)",
            [userId, 'food', foodItem === 'Others' ? customFood : foodItem]
        );
        res.render("donationThanks");
    } catch (err) {
        console.log(err);
        res.send("Error processing donation");
    }
});

app.post("/donate-money", async (req, res) => {
    if (!req.session.userId) {
        return res.redirect("/login");
    }

    const userId = req.session.userId;
    const amount = req.body['amount'];
    const customAmount = req.body['custom-amount'];

    if (amount === 'Others' && customAmount) {
        console.log(`Custom Amount Donation: ${customAmount}`);
    } else {
        console.log(`Selected Amount: ${amount}`);
    }

    try {
        await db.query(
            "INSERT INTO donations (user_id, donation_type, amount) VALUES ($1, $2, $3)",
            [userId, 'money', amount === 'Others' ? customAmount : amount]
        );
        res.render("donationThanks");
    } catch (err) {
        console.log(err);
        res.send("Error processing donation");
    }
});

app.get("/request",(req,res) => {
    if (req.session.userId) {
        res.render("request", { userLoggedIn: true });
    } else {
        res.redirect("/login");
    }
});

app.post("/submit-request", async (req, res) => {

    const userId = req.session.userId;
    const name = req.body.name;
    const email = req.body.email;
    const requestType = req.body["request-type"];
    const details = req.body.details;

    try {
        await db.query(
            "INSERT INTO requests (user_id, name, email, request_type, details) VALUES ($1, $2, $3, $4, $5)",
            [userId, name, email, requestType, details]
        );

        res.render("requestThanks");
    } catch (err) {
        console.error("Error saving the request:", err);
        res.send("An error occurred while submitting your request. Please try again.");
    }
});



app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});

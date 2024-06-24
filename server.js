const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Database setup (simplified)
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Connected...'))
.catch(err => console.log(err));

// Routes will go here
const User = require('./models/User');
const Transaction = require('./models/Transaction');

app.post('/signup', async (req, res) => {
    const { initials } = req.body;
    let accountId;
    // Generate a 4-digit random number and ensure it does not start with 0
    do {
        accountId = Math.floor(Math.random() * 9000 + 1000).toString(); // Generates a number between 1000 and 9999
    } while (await User.findOne({ accountId }));

    const newUser = new User({ accountId, initials });
    try {
        await newUser.save();
        res.status(201).send(newUser);
    } catch (error) {
        res.status(500).send(error.message);
    }
}); 

app.post('/login', async (req, res) => {
    const { accountIdInitials } = req.body; // Extract the combined accountId and initials
    try {
        console.log(accountIdInitials);
        if (!accountIdInitials || accountIdInitials.length < 5) {
            return res.status(400).send('Invalid accountIdInitials');
        }
        // fetch the first 4 characters of the accountIdInitials and the last 
        const accountId = accountIdInitials.substring(0, 4);
        const initials = accountIdInitials.substring(4);


        const user = await User.findOne({ accountId, initials});
        console.log(user );
        if (!user) {
            return res.status(404).send('User not found');
        }
        res.send(user);
    } catch (error) {
        res.status(500).send(error.message);
    }
});


app.get('/users/:ID', async (req, res) => {
    const { ID } = req.params;
    // console.log("Fetching user with accountIdInitials:", ID);
    try {
        const accountId = ID.substring(0, 4);
        // console.log(accountId);
        const user = await User.findOne({ accountId });
        if (!user) {
            return res.status(404).send('User not found');
        }
        // console.log(user);
        res.send(user);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.post('/users/:ID', async (req, res) => {
    const { ID } = req.params;
    const { number } = req.body;
    // console.log("Adding number to user with accountId:", ID);
    try {
        const accountId = ID.substring(0, 4);
        const user = await User
            .findOneAndUpdate({ accountId }, { $inc: { number } }, { new: true });
        if (!user) {
            return res.status(404).send('User not found');
        }
        // console.log(user);
        res.send(user);
    } catch (error) {
        res.status(500).send(error.message);
    }
});


app.post('/send-money', async (req, res) => {
    const { senderId, method, receivers, amount } = req.body;
    console.log("Sending money from user with accountId:", senderId, "using method:", method, "Sending To:", receivers, "Amount:", amount);
    try {
        let transaction;
        let totalAmount = parseFloat(amount);
        let AmountToRecieve = 0;

        if (method === 'by-number') {
            // Fetch receivers based on numbers
            const receiversFromDb = await User.find({ number: { $in: receivers } });
            console.log("Active recievers")
            console.log(receiversFromDb);
            if (totalAmount < 100){
                AmountToRecieve = totalAmount / receiversFromDb.length/2;
                console.log("Each reciever will get:" + AmountToRecieve);
                transaction = new Transaction({ senderId, receiverIds:receiversFromDb.map(receiver => receiver.accountId), AmountToRecieve });
               
            } 

            if (totalAmount > 99 ){
                console.log("To much money");
                AmountToRecieve = 80;
                console.log("Each reciever will get:" + AmountToRecieve);
                transaction = new Transaction({ senderId, receiverIds:receiversFromDb.map(receiver => receiver.accountId), AmountToRecieve });
                // also update user in the receiversFromDb. update the balance
            }

            const update = await User.findOneAndUpdate({ number: { $in: receivers } }, { $inc: { balance: AmountToRecieve } }, { new: true });

        } else if (method === 'by-amount') {
            // Fetch receivers based on amount
            console.log("Fetching receivers based on amount");
            const receiversFromDb = await User.aggregate([
            { $match: { amount: { $lte: amount } } },
            { $sample: { size: receivers.length } }
            ]);
            transaction = new Transaction({ senderId, receiverIds: receiversFromDb.map(r => r._id), amount });
        }
        await transaction.save();
        res.send(transaction);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// fetch transactions for a user
app.get('/transactions/:ID', async (req, res) => {
    const { ID } = req.params;
    console.log("Fetching transactions for user with accountId:", ID);
    try {
        const accountId = ID.substring(0, 4);
        const pipeline = [
            {
                $match: {
                    senderId: accountId
                }
            },
            {
                $lookup: {
                    from: "users", // Assuming the collection name is "users"
                    localField: "receiverIds",
                    foreignField: "_id",
                    as: "receiverDetails"
                }
            },
            {
                $unwind: "$receiverDetails"
            },
            {
                $match: {
                    $or: [
                        { "receiverDetails.accountId": accountId },
                        { "receiverIds": accountId }
                    ]
                }
            }
        ];

        const transactions = await Transaction.aggregate(pipeline);
        console.log(transactions);
        res.send(transactions);
    } catch (error) {
        res.status(500).send(error.message);
    }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
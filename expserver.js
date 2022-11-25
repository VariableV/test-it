import apiObj, { getStudent, getInstructor, createStudent, createInstructor } from './server/store.js';
import express from 'express';
import { connect } from 'mongoose';
import { Assignment, User, Test, Class } from './server/models.js';
import dotenv from "dotenv"
dotenv.config()
const url = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';

connect(url);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());


app.post('/loginUser', (req, res) => {
    if (!req.body) {
        return;
    }
    User.find({ email: req.body.email, password: req.body.password }).count().then((ans) => {
        if (ans) {
            res.status(200).json({ found: true })
        }
        else {
            res.status(200).json({ found: false })
        }
    })
})

app.post('/createStudent', async (req, res) => {
    if (!req.body) {
        return;
    }
    const data = new User({
        email: req.body.email,
        studentAccount: true,
        classes: [],
        name: '',
        bio: '',
        joined: new Date(),
        password: req.body.password
    })
    try {
        const dataToSave = await data.save();
        res.status(200).json(dataToSave)
    }
    catch (error) {
        res.status(400).json({ message: error.message })
    }
});

app.post('/createInstructor', async (req, res) => {
    if (!req.body) {
        return;
    }
    const data = new User({
        email: req.body.email,
        studentAccount: false,
        classes: [],
        name: '',
        bio: '',
        joined: new Date(),
        password: req.body.password
    })
    try {
        const dataToSave = await data.save();
        res.status(200).json(dataToSave)
    }
    catch (error) {
        res.status(400).json({ message: error.message })
    }

});

app.post('/createClass', async (req, res) => {
    if (!req.body) {
        return;
    }
    let classExists = false;

    await Class.findOne({name:req.body.name}).then(val => 
        {
            if(val !== null)
            {
                classExists = true;
            }
        })
        
        if(classExists)
        {
            res.sendStatus(500)
            return;
        }

    const codesArray =  await Class.distinct('enrollCode')

    while(true)
    {
        let rand = Math.floor(Math.random() * 10000)
        if(!codesArray.includes(rand))
        {
            await Class.insertMany({ name: req.body.name, instructor: req.body.email, size: 0, assignments:[] ,enrollCode: rand})
            await  User.updateOne({ email: req.body.email },{ $push: { 'classes': {'className': req.body.name , 'code': rand }}})   
            break;
        }    
    }

   res.sendStatus(200)

});


app.post('/createAssignment', (req, res) => {   // creates assignemnt in class need a class 

    if (!req.body) {
        res.send(400);
        return;
    }
    // can use className as id
    Assignment.insertMany({ 'name': req.body.name, 'className': req.body.class, 'release': new Date(), 'dueDate': new Date(req.body.dueDate) }).then(res => {
        Class.findOne({ name: req.body.class }).then((ans) => {
            ans["classes"].push(req.body.req.body.name)
            ans.save()
        })
    });
});

app.post('/createTestCase', (req, res) => {

    if (!req.body) {
        res.send(400);
        return;
    }

    Test.insertMany({
        name: req.body.name,
        student: req.body.email,
        class: req.body.class,
        assignment: req.body.assignment, // assignment test is associated with
        coverage: Math.floor(Math.random() * 101), // percent coverage
        code: req.body.code // block of code for a test

    })

    res.send(200)

});

app.post('/updateUser', (req, res) => {

    if (!req.body) {
        res.send(400);
        return;
    }

    User.updateOne({ email: req.body.email }, { $set: { 'name': req.body.name, 'bio': req.body.bio } })

    res.send(200)

});

app.post('/enrollClass' ,async (req,res) => {
    // increment the size value of that class
    let code = req.body.code;
    let email = req.body.email;
    let found = true;
    let className = "";

   await Class.updateOne({'enrollCode' : code} , {$inc: {'size' : 1}}).then((ans) => {
        if(ans.matchedCount === 0)
        {
            found = false; 
        }
    })
    if(!found)
    {   
        res.sendStatus(500)
        return
    }

    let classObj = await Class.findOne({'enrollCode' : code})

    await User.updateOne({email:email} , {$push:{'classes' : {'className': classObj['name'] , 'code': req.body.code }}})

    res.sendStatus(200);
       
})

app.get('/getUser/:email', (req , res) => 
{
    let name = ''
    let email = ""
    let classes = [];
    let testCases = [];
    let bio = ''
    let joined = ''

    User.findOne({"email": req.params['email']
        
    }).then((res2) => {
        classes = res2['classes']
        email = res2['email']
        name = res2['name']
        bio = res2['bio']
        joined = res2['joined']

        if(res2['studentAccount'])
        {

            Test.findOne({ 'email': req.params['email'] }).then((res) => {
                testCases = res;
            })

            res.json({
                'name': name,
                'bio': bio,
                'email': email,
                'classes': classes,
                'testCases': testCases,
                'joined' : joined,
                'studentAccount': res2['studentAccount']
            });
        }
        else
        {
            res.json({
                'name': name,
                'bio': bio,
                'email': email,
                'classes': classes,
                'testCases': testCases,
                'joined' : joined,
                'studentAccount': res2['studentAccount']
            });
        }
    })
})

app.get('/getClass/:class', (req, res) => {

    Class.findOne({'name' : req.params['class']}).then((response) => 
    {
        res.json(response)
    })
    
});

app.get('/getClassByCode/:enrollCode', (req, res) => {

    Class.findOne({'enrollCode' : req.params['enrollCode']}).then((response) => 
    {
        res.json(response)
    })
    
});




app.get('/getAssignments/:class', (req, res) => { //plural , used to populate table in student's dashboard


    Assignment.find({ class: req.params['class'] }).then(res => {
        res.json({ ans: res })
    })
});

app.get('/getAssignment', (req, res) => { //singular , used for the assignment page , need class and assignmentName
    if (!req.body) {
        return;
    }
    Assignment.find({
        $and: [
            {
                "name": req.body.name
            },
            {
                "class": req.body.class
            }
        ]
    }).then(res => {
        res.json({ 'result': res })
    })
});




app.use('/components/appNavbar/', express.static('components/appNavBar'));
app.use('/components/loginNavbar/', express.static('components/loginNavbar'));
app.use('/constants/images/', express.static('constants/images'));


app.use('/', !apiObj['student'] && !apiObj['instructor'] ? express.static('pages/Landing/Login') : express.static('pages/Dashboard/Assignment'))
apiObj['student'] && app.use('/profile', express.static('pages/Profile'));
app.use('/signup', express.static('pages/Landing/Signup'));
app.use('/login', express.static('pages/Landing/Login'));
app.use('/assignment', express.static('pages/Dashboard/Assignment'));
app.use('/dashboard', express.static('pages/Dashboard/Dashboard'));
app.use('/profile', express.static('pages/Profile'));


app.listen(port, () => {
    console.log(`app listening on port ${port}`)
});



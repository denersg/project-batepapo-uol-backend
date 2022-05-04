import express, { json } from "express";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import chalk from "chalk";
import dayjs from "dayjs";
import cors from "cors";
import joi from "joi";

const app = express();//Criando o servidor
app.use(cors());
app.use(json());//Recebendo objetos JavaScript (JSON)
dotenv.config();

/* ------------------------------------------ FAZENDO O 'get' de 'participantes' ------------------------------------------ */

app.get("/participants", async (req, res) => {
    const mongoClient = new MongoClient(process.env.MONGO_URL);
    try{
        await mongoClient.connect();
        const database = mongoClient.db("batepapo_uol_database");

        const participants = await database.collection("participants").find().toArray();
        res.send(participants);

        mongoClient.close();
    }
    catch(error){
        console.log(error);
        res.sendStatus(500);
        mongoClient.close();
    }
});

/* ------------------------------------------ FAZENDO O 'post' de 'participantes' ------------------------------------------ */

app.post("/participants", async (req, res) => {
    const body = req.body;
    const participantSchema = joi.object({
        name: joi.string().required()
    });
    const validation = participantSchema.validate(body);
    if(validation.error){
        console.log(validation.error.details);
        res.sendStatus(422);
        return;
    }

    const mongoClient = new MongoClient(process.env.MONGO_URL);
    try{
        await mongoClient.connect();
        const database = mongoClient.db("batepapo_uol_database");

        const isNameExisting = await database.collection("participants").findOne({ name: body.name });
        if(isNameExisting !== null){
            mongoClient.close();
            return res.sendStatus(409);
        }

        const participant = {
            name: body.name,
            lastStatus: Date.now()
        };

        await database.collection("participants").insertOne(participant);
        res.sendStatus(201);
        sendAutomaticMessage(participant);

        mongoClient.close();
    }
    catch(error){
        console.log(error);
        res.sendStatus(500);
        mongoClient.close();
    }
});

function sendAutomaticMessage(participant){
    let database;
    
    const message = {
        from: participant.name,
        to: "Todos",
        text: "entra na sala...",
        type: "status",
        time: dayjs().format("HH:mm:ss")
    };

    const mongoClient = new MongoClient(process.env.MONGO_URL);
    const promise = mongoClient.connect();
    promise.then(() => {
        database = mongoClient.db("batepapo_uol_database");
        promise.then(() => {
            const promise = database.collection("messages").insertOne(message);
            mongoClient.close();
        });
    });
};

/* ------------------------------------------ FAZENDO O 'post' de 'mensagens' ------------------------------------------ */

app.post("/messages", async (req, res) => {
    const body = req.body;
    const headers = req.headers;

    const messageSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().required()
    });

    const validation = messageSchema.validate(body);
    if(validation.error){
        console.log(validation.error.details);
        res.sendStatus(422);
        return;
    }
    if(body.type != "message" && body.type != "private_message"){
        res.sendStatus(422);
        return;
    }

    const mongoClient = new MongoClient(process.env.MONGO_URL);
    try{
        await mongoClient.connect();
        const database = mongoClient.db("batepapo_uol_database");

        const isNameOnList = await database.collection("participants").findOne({name: headers.user});
        if((isNameOnList !== null) && (isNameOnList.name !== headers.user)){
            mongoClient.close();
            return res.sendStatus(422);
        }

        const message = {
            from: headers.user,
            to: body.to,
            text: body.text,
            type: body.type,
            time: dayjs().format("HH:mm:ss")
        };

        await database.collection("messages").insertOne(message);
        res.sendStatus(201);
        mongoClient.close();
    }
    catch(error){
        console.log(error);
        res.sendStatus(500);
        mongoClient.close();
    }
});

/* ------------------------------------------ FAZENDO O 'get' de 'mensagens' ------------------------------------------ */

app.get("/messages", async (req, res) => {
    const mongoClient = new MongoClient(process.env.MONGO_URL);
    const limit = parseInt(req.query.limit);
    try{
        await mongoClient.connect();
        const database = mongoClient.db("batepapo_uol_database");

        const messages = await database.collection("messages").find().toArray();

        if(isNaN(limit)){
            res.send(messages);
            mongoClient.close();
            return;
        }
        else{
            //Imprime a quantidade requerida
            res.send(messages.slice(0, limit));
            mongoClient.close();
        }
    }
    catch(error){
        console.log(error);
        res.sendStatus(500);
        mongoClient.close();
    }
});

/* ------------------------------------------ FAZENDO O 'post' de 'status' ------------------------------------------ */

app.post("/status", async (req, res) => {
    const headers = req.headers;
    const mongoClient = new MongoClient(process.env.MONGO_URL);
    try{
        await mongoClient.connect();
        const database = mongoClient.db("batepapo_uol_database");

        const participantExists = await database.collection("participants").findOne({name: headers.user});
        if(participantExists.name !== headers.user){
            mongoClient.close();
            return res.sendStatus(404);
        }
        
        participantExists.lastStatus = Date.now();
        res.sendStatus(200);
    }
    catch(error){
        console.log(error);
        res.sendStatus(500);
        mongoClient.close();
    }
});

app.listen(5000, () => {
    const serverOn = chalk.hex("#ba68c8");
    console.log(serverOn.bold("Servidor em pé na porta 5000"));
});
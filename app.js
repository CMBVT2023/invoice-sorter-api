import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

import { FileSystem } from './filesystem.js'

const backEnd = express();
const port = 3000;

const fileAccess = new FileSystem();

backEnd.use(cors({
    origin: 'http://localhost:5173/',
}))

backEnd.get('/getDirectories', async (req, res) => {
    try {
        let customers = await fileAccess.getAllCustomerFolders();
        res.send({customersArray: customers});
    } catch (error) {
        console.error(`Error: ${error}`);
        res.status(500).send('Server Error');
    }
})

backEnd.get('/getInvoice', async (req, res) => {
    try {
        let [ invoiceRelativePath, invoicePDF ] = await fileAccess.getInvoice();

        //? A response body is used to store the relative file path and the file's encoded string before being sent to the user.
        let responseBody = {
            fileName: invoiceRelativePath,
            file: invoicePDF 
        }

        res.json(responseBody)
    } catch (error) {
        console.error(`Error: ${error}`);
        res.status(500).send('Server Error');
    }
})

backEnd.post('/sortFile', async (req, res) => {
    try {
        let requestQueryParameters = req.query;

        let [isSuccessful, transferMessage, undoObj] = await fileAccess.sortFile(requestQueryParameters);
        let actionId = (Date.now() * Math.random()).toString(16)
        
        res.send({result: isSuccessful ? 'Succeeded' : 'Failed', message: transferMessage, undoInfo: undoObj, id: actionId, action: 'File Transfer'});
    } catch (error) {
        console.error(`Error: ${error}`);
        res.status(500).send('Server Error');
    }
})

backEnd.post('/createNewFolder', async (req, res) => {
    try {
        let requestQueryParameters = req.query;
        
        let [isSuccessful, transferMessage, undoObj] = await fileAccess.createNewFolder(requestQueryParameters)
        let actionId = (Date.now() * Math.random()).toString(16)

        res.send({result: isSuccessful ? 'Succeeded' : 'Failed', message: transferMessage, undoInfo: undoObj, id: actionId, action: 'Folder Creation'})
    } catch (error) {
        console.error(`Error: ${error}`);
        res.status(500).send('Server Error');
    }
})

backEnd.post('/undoAction', async (req, res) => {
    try {
        let requestQueryParameters = req.query;

        // Remember to parse the undoInfo back into an object.

        
        let [isSuccessful, transferMessage, undoneActionId] = await fileAccess.undoPreviousAction(requestQueryParameters)
        let actionId = (Date.now() * Math.random()).toString(16)

        res.send({result: isSuccessful ? 'Succeeded' : 'Failed', message: transferMessage, undoneActionId, id: actionId, action: 'Undo Action'})
    } catch (error) {
        console.error(`Error: ${error}`);
        res.status(500).send('Server Error');
    }
})

backEnd.get('/test', async (req, res) => {
    try {
        res.send({data: 'Successfully connected.'});
    } catch (error) {
        console.error(`Error: ${error}`);
        res.status(500).send('Server Error');
    }
})

async function startBackend() {
    try {
        // Checks that the fileAccess class's customer folder and invoice directories string attributes are valid paths before opening up the server.
        // Along with checking the letter folders within the customer folders directory, and if a letter folder is missing, one is created.

        let validationResult = await fileAccess.loadDirectoryPaths('./DirectoryPaths.json');
        if (!validationResult.valid) throw new Error(validationResult.message)
            
        backEnd.listen(port, () => {
            console.log(`Server running at http://localhost:${port}\n${validationResult.message}`);
        }) 
    } catch (error) {
        console.error(error);   
    }
}

startBackend();
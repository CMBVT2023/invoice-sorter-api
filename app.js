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

backEnd.get('/:page/get-directories', async (req, res) => {
    try {
        let { page: pageRouteQuery} = req.params;
        let directories;

        if (pageRouteQuery == 'customer-scanned-documents') {
            directories = await fileAccess.getAllCustomerFolders();
        }

        res.send({directoriesArray: directories});
    } catch (error) {
        console.error(`Error: ${error}`);
        res.status(500).send('Server Error');
    }
})

backEnd.get('/:page/get-invoice', async (req, res) => {
    try {
        let { page: pageRouteQuery} = req.params;

        let invoiceRelativePath, invoicePDF;

        if (pageRouteQuery == 'customer-scanned-documents') {
            [ invoiceRelativePath, invoicePDF ] = await fileAccess.getInvoice();
        }
        
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

backEnd.post('/:page/sort-file', async (req, res) => {
    try {
        let isSuccessful, transferMessage, undoObj;
        let requestQueryParameters = req.query;
        let { page: pageRouteQuery} = req.params;

        if (pageRouteQuery == 'customer-scanned-documents') {
            [isSuccessful, transferMessage, undoObj] = await fileAccess.sortFile(requestQueryParameters);
        }
        let actionId = (Date.now() * Math.random()).toString(16)
        
        res.send({result: isSuccessful ? 'Succeeded' : 'Failed', message: transferMessage, undoInfo: undoObj, id: actionId, action: 'File Transfer'});
    } catch (error) {
        console.error(`Error: ${error}`);
        res.status(500).send('Server Error');
    }
})

backEnd.post('/:page/create-new-folder', async (req, res) => {
    try {
        let isSuccessful, transferMessage, undoObj;
        let requestQueryParameters = req.query;
        let { page: pageRouteQuery} = req.params;

        if (pageRouteQuery == 'customer-scanned-documents') {
            [isSuccessful, transferMessage, undoObj] = await fileAccess.createNewFolder(requestQueryParameters);
        }


        let actionId = (Date.now() * Math.random()).toString(16)

        res.send({result: isSuccessful ? 'Succeeded' : 'Failed', message: transferMessage, undoInfo: undoObj, id: actionId, action: 'Folder Creation'})
    } catch (error) {
        console.error(`Error: ${error}`);
        res.status(500).send('Server Error');
    }
})

backEnd.post('/undo-action', async (req, res) => {
    try {
        let requestQueryParameters = req.query;
        
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
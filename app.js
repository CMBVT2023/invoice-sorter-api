import express from 'express';
import cors from 'cors';

import { loadDB } from './dbaccess.js';
import { registerUser, validateUserSession } from './accounts.js';
import { FileSystem, validateDirectoryPathsFile } from './filesystem.js'

const backEnd = express();
const port = 3000;

const fileAccessClasses = {};
const pageNames = ['customer-scanned-documents', 'accounts-payables']

function loadFileAccessClasses() {
    for (const pageName of pageNames) {
        fileAccessClasses[pageName] = new FileSystem(pageName);
    }
}

async function startBackend() {
    try {
        // Checks that all the constructed class' directory folders and invoice directory string attributes are valid paths before opening up the server.
        // Also, the letter folders within the storage directories are verified, and if a letter folder is missing, one is created.

        let mainValidationMessage = '';

        let [ validationResult, directoryPaths ] = await validateDirectoryPathsFile('./DirectoryPaths.json');
        if (!validationResult) throw new Error('Paths Settings File does not exist!');
        
        for (const pageName of pageNames) {
            let invoicesPath = directoryPaths[`${pageName}-invoices`];
            let directoriesPath = directoryPaths[`${pageName}-directories`];
            let validationResult = await fileAccessClasses[pageName].loadDirectoryPaths(invoicesPath, directoriesPath);
            if (!validationResult.valid) throw new Error(validationResult.message)
            mainValidationMessage += `${validationResult.message}\n`;
        }

        backEnd.listen(port, () => {
            console.log(`Server running at http://localhost:${port}\n${mainValidationMessage}`);
        }) 
    } catch (error) {
        console.error(error);   
    }
}

backEnd.use(cors({
    origin: 'http://localhost:5173/',
}))

// Parses the request's body into valid json.
backEnd.use(express.json())

// Initializes a connection to the db.
backEnd.use(loadDB)

backEnd.post('/register', registerUser)

// backEnd.post('login', () => {})

// Validates the request's user session via the passed in jwt
backEnd.use(validateUserSession)

backEnd.get('/:page/get-directories', async (req, res) => {
    try {
        let { page: pageRouteQuery} = req.params;
        if (!pageRouteQuery) throw new Error('Invalid Page Route Query!')

        let directories = await fileAccessClasses[pageRouteQuery].getAllDirectories();

        res.send({directoriesArray: directories});
    } catch (error) {
        console.error(`Error: ${error}`);
        res.status(500).send('Server Error');
    }
})

backEnd.get('/:page/get-invoice', async (req, res) => {
    try {
        let { page: pageRouteQuery} = req.params;
        if (!pageRouteQuery) throw new Error('Invalid Page Route Query!')

        let [ invoiceRelativePath, invoicePDF ] = await fileAccessClasses[pageRouteQuery].getInvoice();
        
        //? A response body is used to store the relative file path and the file's encoded string before being sent to the user.
        let responseBody = {
        fileName: invoiceRelativePath,
            file: invoicePDF 
        }

        res.json(responseBody)
    } catch (error) {
        console.log(error.message)
        if (error.message == "No Valid Files Within Invoice Directory.") {
            res.status(503).send(`${error}`)
        } else {
            console.error(`Error: ${error}`);
            res.status(500).send('Server Error');
        }
    }
})

backEnd.post('/:page/sort-file', async (req, res) => {
    try {
        let { page: pageRouteQuery} = req.params;
        if (!pageRouteQuery) throw new Error('Invalid Page Route Query!');

        let requestQueryParameters = req.query;

        let [isSuccessful, transferMessage, undoObj] = await fileAccessClasses[pageRouteQuery].sortFile(requestQueryParameters);
        let actionId = (Date.now() * Math.random()).toString(16)
        
        res.send({result: isSuccessful ? 'Succeeded' : 'Failed', message: transferMessage, undoInfo: undoObj, id: actionId, action: 'File Transfer'});
    } catch (error) {
        console.error(`Error: ${error}`);
        res.status(500).send('Server Error');
    }
})

backEnd.post('/:page/create-new-folder', async (req, res) => {
    try {
        let { page: pageRouteQuery} = req.params;
        if (!pageRouteQuery) throw new Error('Invalid Page Route Query!')

        let requestQueryParameters = req.query;

        let [isSuccessful, transferMessage, undoObj] = await fileAccessClasses[pageRouteQuery].createNewFolder(requestQueryParameters);


        let actionId = (Date.now() * Math.random()).toString(16)

        res.send({result: isSuccessful ? 'Succeeded' : 'Failed', message: transferMessage, undoInfo: undoObj, id: actionId, action: 'Folder Creation'})
    } catch (error) {
        console.error(`Error: ${error}`);
        res.status(500).send('Server Error');
    }
})

backEnd.post('/:page/undo-action', async (req, res) => {
    try {
        let { page: pageRouteQuery} = req.params;
        if (!pageRouteQuery) throw new Error('Invalid Page Route Query!')
            
        let requestQueryParameters = req.query;
        
        let [isSuccessful, transferMessage, undoneActionId] = await fileAccessClasses[pageRouteQuery].undoPreviousAction(requestQueryParameters)

        
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

loadFileAccessClasses(pageNames);
startBackend();

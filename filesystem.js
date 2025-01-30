import * as fs from 'fs/promises';

/**
* @function Validates that the paths settings file exists and if it does the json object containing the various path string for all file directories is parsed and returned.
* @param {string} pathSettingsFile - A string representing the path to the paths settings file.
* @returns An array containing a boolean that signifies if the settings file exists, true if it does and false if not. If the file does exist then the json object within it is pushed to the array.
* Otherwise, in the event the the paths settings file does not exists or another error occurs a null value is pushed instead.
*/
export async function validateDirectoryPathsFile(pathSettingsFile) {
    try {
        //* Attempts to check the user's permissions for a file or directory, and if it can read the permissions from said file or directory it exists.
        await fs.access(pathSettingsFile)
        let isFileValid = await fs.access(pathSettingsFile);
        let directoryPaths = JSON.parse(await fs.readFile(pathSettingsFile));
        return [true, directoryPaths];
    } catch (error) {
        //* If an error occurs due to the path not leading to any file or directory, then the file does not exist.
        return [false, null];
    }
}

export class FileSystem {
    constructor(fileSystemName) {
        this._fileSystemName = fileSystemName;
        this._invoiceFolderPath;
        this._directoriesFolderPath;
    }

    async loadDirectoryPaths(invoicePathString, directoriesPathString) {
        try {
            this._invoiceFolderPath = invoicePathString;
            this._directoriesFolderPath = directoriesPathString;

            let [areMainDirectoriesValid, mainPathValidatorMessage] = await this._validateMainDirectories();
            if (!areMainDirectoriesValid) throw new Error(mainPathValidatorMessage);
            
            let [areLetterFoldersInitialized, letterFoldersValidatorMessage] = await this._validateLetterFolders();
            if (!areLetterFoldersInitialized) throw new Error(letterFoldersValidatorMessage);

            return {valid: true, message: `${mainPathValidatorMessage}\n${letterFoldersValidatorMessage}\n`}
        } catch (error) {
            console.error(error)
            return {valid: false, message: error.message}
        }
    }

    async _validateMainDirectories() {
        let isDirectoriesFoldersPathValid = await this._checkPath(this._directoriesFolderPath);
        let isInvoiceFolderPathValid = await this._checkPath(this._invoiceFolderPath);
        if (isDirectoriesFoldersPathValid && isInvoiceFolderPathValid) return [true, `All Main Directory Paths are valid for ${this._fileSystemName}.`];

        let errorMessage = 'Invalid Paths:\n';
        
        //? Checks that the two main directories exist within at their specified path else an error for them is thrown.
        if (!isInvoiceFolderPathValid) errorMessage += `${this._fileSystemName} - Invoice Directory Path ${this._invoiceFolderPath} is invalid!\n`;
        if (!isDirectoriesFoldersPathValid) errorMessage += `${this._fileSystemName} - Directories Folder Path ${this._directoriesFolderPath} is invalid!\n`;
        
        return [false, errorMessage];
    }

    async _validateLetterFolders() {
        try {
            let alphabetArray = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
            let letterFoldersPathArray = alphabetArray.map(letter => `${this._directoriesFolderPath}/${letter}`);
            
            let pathValidatorResult;
            let invalidLetterFolder;
            do {
                [pathValidatorResult, invalidLetterFolder] = await this._validatePaths(letterFoldersPathArray);
                if (!pathValidatorResult) {
                    let hasFolderCreationFailed = await fs.mkdir(invalidLetterFolder);
                    if (hasFolderCreationFailed) throw new Error(`Failed to initialize missing letter folders.`)
                }
            } while (!pathValidatorResult);

            return [true, `All Letter Folders are initialized for ${this._fileSystemName}.`]
        } catch (error) {
            return [false, error.message]
        }
    }

    /**
    * @method Determines if the passed in path string points to an existing file or directory. 
    * @param {string} path - String value of the path that will be checked.
    * @returns a boolean - True is returned if there is an associated file or directory and false if no file or directory exists.
    */
    async _checkPath(path) {
        try {
            //* Attempts to check the user's permissions for a file or directory, and if it can read the permissions from said file or directory it exists.
            await fs.access(path);
            return true;
        } catch (error) {
            //* If an error occurs due to the path not leading to any file or directory, then the file does not exist.
            return false;
        }
    } 

    /**
    * @method Determines if the passed path strings in the passed in array are valid paths. 
    * @param {Array} pathArray - An array of paths strings that will be verified.
    * @returns an array containing a boolean, true if the array contains all valid paths and false if one or more paths are invalid, and if an invalid path is found, the invalid path string is returned
    * in teh array, otherwise this value will be null.
    */
    async _validatePaths(pathArray) {
        try {
            for (const path of pathArray) {
                if (!(await this._checkPath(path))) {
                    throw new Error(path);
                }
            }

            return [true, null];
        } catch ({message: invalidPath}) {
            return [false, invalidPath]
        }
    }

    async _moveFile(sourcePath, destinationPath) {
        try {
            //? Checks the source and destination path strings.
                //* Source path should be a valid path and destination path should not be.
            if (!(await this._checkPath(sourcePath))) throw new Error(`SourcePathInvalid`);
            if (await this._checkPath(destinationPath)) throw new Error(`DestinationPathAlreadyInUse`);

            //? Attempts to copy the file from the sourcePath to the destinationPath, if the copy action fails an error is thrown 
            //? with an appropriate message and cause identifier.
            let hasFileCopyFailed = await fs.copyFile(sourcePath, destinationPath);
            if (hasFileCopyFailed) throw new Error(`failedToCopyFile`)
                
            //? Attempts to delete the file that the sourcePath points to, if the deletion action fails an error is thrown 
            //? with an appropriate message and cause identifier.
            let hasFileDeletionFailed = await fs.rm(sourcePath);
            if (hasFileDeletionFailed) throw new Error(`failedToDeleteFile`)

            // Returns true if the process successfully executed
            return [true, null]
        } catch (error) {
            // If any error is thrown or occurs, false is returned and the error's message.
            return [false, error.message]
        }
    }

    async getAllDirectories() {
        try {
            //? First gathers the various letter folders within the directories folder
            if (!(await this._checkPath(this._directoriesFolderPath))) throw new Error('Directories Folder path is invalid.');
            let alphabetFolders = await fs.readdir(this._directoriesFolderPath);
            let allDirectories = [];
            //? Iterates through all of the letter folders
            for await (const letter of alphabetFolders) {
                //* If the name of the folder is longer than one character, then it is not a letter folder and can be skipped over.
                if (letter.length > 1) continue;
                //? Appends an array of all folder names within the current letter folder
                let directoryContents = await fs.readdir(`${this._directoriesFolderPath}/${letter}`);
                allDirectories.push(directoryContents);
            }
            
            //* Returns the array in alphabetical order of all the directory names within each letter folder.
            return allDirectories;
        } catch (error) {
            console.error(error);
        }
    }

    async getInvoice(requestQueryParameters) {
        try {
            //? Reads the folder where all the invoice are located and looks for the first invoice in the list and saves it path as a string.
            let invoiceFolder = await fs.readdir(this._invoiceFolderPath);
            
            let invoicePath = '';
            let invoiceName = '';
            let offset = 0;
            let invoiceStat;
            do {
                if (invoiceFolder.length <= offset) throw new Error('No Valid Files Within Invoice Directory.');
                invoicePath = `${this._invoiceFolderPath}/${invoiceFolder[offset]}`;
                invoiceName = invoiceFolder[offset]
                offset++;
                invoiceStat = await fs.stat(invoicePath)
            } while (!invoiceStat.isFile());
    
            //* Reads the file and saves it output and encodes it to base64 to convert the binary data to readable text
            //* that the webpages can handle,
                //! skipping this step resulted in the binary data becoming corrupted once it was received by the client.
            let fileStream = await fs.readFile(invoicePath)
    
            let encodedFileStream = fileStream.toString('base64')
    
            return [invoiceName, encodedFileStream];
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    async _checkForYearFolder(directoryFolderPath, year) {
        try {
            let directoryYearPath = `${directoryFolderPath}/${year}`
            if (!(await this._checkPath(directoryYearPath))) {
                let hasCreationFailed = await fs.mkdir(directoryYearPath);
                if (hasCreationFailed) throw new Error(`Failed to make a ${year} year directory within ${directoryFolderPath}.`)
            }

            return [true, directoryYearPath];
        } catch (error) {
            console.error(error)
            return [false, error.message];
        }
    }

    async _checkInvoiceFileName(folderPath, invoiceName) {
        try {
            //? Concatenates the new path for the invoice. 
            let newInvoicePath = `${folderPath}/${invoiceName}`;

            //? Checks that said path does not already exists, and if not, the new path string is returned.
            if (!(await this._checkPath(newInvoicePath))) return [newInvoicePath, invoiceName];
            
            //* Creates the regex pattern for find the copy indicator for a file.
            let copyPattern = /\((\d+)\)/ // Searches for () and captures the numbers between them.

            do {
                //? Checks if the file already has the copy indicator, and if not it appends it right before the file extension, and the value starts at 2.
                if (!copyPattern.test(invoiceName)) {
                    invoiceName = `${invoiceName.substring(0, invoiceName.lastIndexOf('.'))} (2).pdf`
                } else {
                    //? If the copy pattern is already appended to the file, then increment its count by one.
                    invoiceName = invoiceName.replace(copyPattern, (_, copyNumber) => `(${parseInt(copyNumber) + 1})`)
                }
                //? Concatenates the new path.
                newInvoicePath = `${folderPath}/${invoiceName}`;
                //* Runs the while loop so long as the new path string already points to a file.
            } while ((await this._checkPath(newInvoicePath)));
            

            //? Once the while loop stops running, the new path string should be unique and can be returned to allow the storing of said invoice without overwriting another one.
            return [newInvoicePath, invoiceName];
        } catch (error) {
            throw new Error(error.message)
        }
    }
    
    async sortFile(queries) {
        //? Separates the query parameters that were passed with the fetch call. These are declared in the function's body to allow access to these values from the catch statement in case of an error occuring.
        let {directoryFolderPath, directoryName, invoiceName, year} = queries;
        //? Initializes the newInvoiceName variable in the function's body for the same reason listed above to better determine when in the process an error is occurring.
        let newInvoiceName = null;
        try {
    
            //? Construct the folder paths for the storage directory and the invoice using the base paths specified.
            let invoiceFilePath = `${this._invoiceFolderPath}/${invoiceName}`;
            let directoryFolderAbsolutePath = `${this._directoriesFolderPath}/${directoryFolderPath}`;
            
            //? Validate the invoice and storage directory folder path constructed above.
            let [arePathsValid, invalidPath] = await this._validatePaths([directoryFolderAbsolutePath, invoiceFilePath])
            if (!arePathsValid) throw new Error(`Transfer Failed - ${invalidPath} does not exist!`);
            
            //? Validate that a year folder already exist within the storage directory, and if not one is created.
            //! If any error results from attempting to create one the error is thrown to stop all proceeding code.
            let [isYearFolderCreated, yearFolderCheckResult] = await this._checkForYearFolder(directoryFolderAbsolutePath, year);
            if (!isYearFolderCreated) throw new Error(yearFolderCheckResult);

            //? Cycles through the storage directory to check if the current invoice name is already in use, and if so, cycles through copy numbers until an unused file name is found.
            //* Once the new path is found, deconstruction is used to assign the new path and the new invoice name to variables.
            let invoiceToDirectory;
            [invoiceToDirectory, newInvoiceName] = await this._checkInvoiceFileName(yearFolderCheckResult, invoiceName);
            
            let [isFileMoved, fileMoveErrorCause] = await this._moveFile(invoiceFilePath, invoiceToDirectory);
            if (isFileMoved) {
                return [true, `Transfer Successful - ${newInvoiceName} moved to ${directoryName}.`, {oldInvoiceName: invoiceName, newInvoiceName, directoryFolderPath, directoryName, year}];
            } else {
                switch (fileMoveErrorCause) {
                    case 'SourcePathInvalid': {
                        throw new Error(`Invoice ${newInvoiceName} was not found in invoice directory.`)
                        break;
                    }
                    case 'DestinationPathAlreadyInUse': {
                        throw new Error(`Directory ${directoryName} already contains a ${newInvoiceName} invoice file.`)
                        break;
                    }
                    case 'failedToCopyFile': {
                        throw new Error('Failed to copy invoice to new location!');
                        break;
                    }
                    case 'failedToDeleteFile': {
                        throw new Error('Failed to remove invoice from original location!');
                        break;
                    }   
                }
            }
        } catch (error) {
            console.error(error)
            let transferFailedMessage = `Transfer Failed - ${invoiceName} failed to transfer to ${directoryName}.`
            if (newInvoiceName && newInvoiceName != invoiceName) transferFailedMessage += `\nAttempted to rename ${invoiceName} to ${newInvoiceName}.`
            return [false, transferFailedMessage];
        }
    }

    /**
    * @method Initialized a new directory within the directories folder path. The directory folder is initialized based on the passed in query parameters gathered by a fetch request.
    * A new path string is concatenated and check for potential conflicts.
    * @param {object} requestQueryParameters - Query parameters used for creating the new directory's path string. It includes a directoryFolderName and letterFolder property.
    * @returns an array of three items, a boolean to signify if the initialized was successful, a string describing the outcome, and an object containing the information required to undo the action.
    */
    async createNewFolder(requestQueryParameters) {
        let {directoryFolderName, letterFolder} = requestQueryParameters;
        try {
            let newDirectoryFolderPath = `${this._directoriesFolderPath}/${letterFolder}/${directoryFolderName}`
            
            if ((await this._checkPath(newDirectoryFolderPath))) throw new Error('Directory Already Exists!', {cause: 'conflict'});

            let hasFolderCreationFailed = await fs.mkdir(newDirectoryFolderPath);

            if (hasFolderCreationFailed) throw new Error(`Failed to create a directory at path ${newDirectoryFolderPath}`);

            return [true, `Initialization Successful - Directory ${directoryFolderName} Was Created.`, {directoryName: directoryFolderName, letterFolder}]
        } catch (error) {
            console.error(error)
            if (error.cause == 'conflict') return [false, `Initialization Failed - Directory ${directoryFolderName} Already Exists!`]
            return [false, `Initialization Failed - Failed to create ${directoryFolderName} folder.`]
        }
    }

    async undoPreviousAction(requestQueryParameters) {
        let { action, actionId, undoInfo } = requestQueryParameters;
        let undoInfoObj = JSON.parse(undoInfo);
        let finalTransferMessage;
        try {
            if ( action == 'Folder Creation') {
                /* 
                First, check if the folder exists within the system,
                Next, I need to check that the folder is empty and if not stop the undo process and return an error or failure message.
                If it passes the check, I need to call the remove directory method and pass in the directory's path.
                Finally, the returned value from the method can be used to determine if the directory was successfully deleted
                */

                //? Creates the directory's path with the info from the passed in undoInfo object.
                let directoryToBeRemoved = `${this._directoriesFolderPath}/${undoInfoObj.letterFolder}/${undoInfoObj.directoryName}`

                //? Checks that the directory exists via the path and if not, an error is thrown.
                if (!(await this._checkPath(directoryToBeRemoved))) throw new Error(`Folder ${undoInfoObj.directoryName} does not exists within the ${undoInfoObj.letterFolder} directory.`, {cause: 'invalidPath'})

                let hasDirectoryRemovalFailed = await fs.rmdir(directoryToBeRemoved);

                if (hasDirectoryRemovalFailed) throw new Error(`Failed to remove directory at path ./${undoInfoObj.letterFolder}/${undoInfoObj.directoryName}.`, {cause: 'removalFailed'})

                finalTransferMessage = `Undo Action Successful - ${action} has successfully been undone. Directory ${undoInfoObj.directoryName} has been successfully removed.`
            } else if ( action == 'File Transfer') {
                /* 
                First, check if the file exists within the specified directory,
                Next, I need to check if the invoice name would be unique before being transferred to the invoice directory.
                    And if it is not unique I need to cycle through until I find a name that is,
                Finally, I can proceed with the copying of said file to the invoice directory
                and finish with removing the file from the storage directory.
                */
                // {oldInvoiceName, newInvoiceName, directoryFolderPath, directoryName, year}

                let invoiceToBeRemoved = `${this._directoriesFolderPath}/${undoInfoObj.directoryFolderPath}/${undoInfoObj.year}/${undoInfoObj.newInvoiceName}`

                let invoiceFileName = undoInfoObj.newInvoiceName == undoInfoObj.oldInvoiceName ? undoInfoObj.newInvoiceName : undoInfoObj.oldInvoiceName

                let [invoiceReturnPath, uniqueInvoiceName] = await this._checkInvoiceFileName(this._invoiceFolderPath, invoiceFileName);

                let [isFileMoved, fileMoveErrorCause] = await this._moveFile(invoiceToBeRemoved, invoiceReturnPath);
                if (isFileMoved) {
                    finalTransferMessage = `Undo Action Successful - ${action} has successfully been undone. File ${undoInfoObj.newInvoiceName} has been successfully removed from ${undoInfoObj.directoryName}.`;
                    if (invoiceFileName != uniqueInvoiceName) finalTransferMessage += `\nReturned invoice has been renamed from ${invoiceFileName} to ${uniqueInvoiceName}.`
                } else {
                    switch (fileMoveErrorCause) {
                        case 'SourcePathInvalid': {
                            throw new Error(`Invoice ${undoInfoObj.newInvoiceName} was not found in directory ${undoInfoObj.directoryName}.`)
                            break;
                        }
                        case 'DestinationPathAlreadyInUse': {
                            throw new Error(`Invoice directory already contains a ${undoInfoObj.uniqueInvoiceName} invoice file.`)
                            break;
                        }
                        case 'failedToCopyFile': {
                            throw new Error(`Failed to transfer invoice ${undoInfoObj.newInvoiceName} back to invoice directory from ${undoInfoObj.directoryName}.`);
                            break;
                        }
                        case 'failedToDeleteFile': {
                            throw new Error(`Failed to delete invoice ${undoInfoObj.newInvoiceName} from ${undoInfoObj.directoryName}.`);
                            break;
                        }   
                    }
                }
            }

            return [true, finalTransferMessage, actionId]
        } catch (error) {
            console.error(error)
            //* Initializes an error message variable to allow additional info to be appended to the message based on error that has occurred.
            let errorMessage = `Undo Action Failed - Failed to undo ${action}.`;
            if (error.code == "ENOTEMPTY") errorMessage += `\nFolder ${undoInfoObj.directoryFolderPath} is not empty.`;
            if (!(error.code)) errorMessage +=`\n${error.message}`;
            console.log(errorMessage)
            return [false, errorMessage]
        }
    }
}
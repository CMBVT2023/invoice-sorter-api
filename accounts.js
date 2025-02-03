import express from 'express';
import jwt from 'jsonwebtoken'
import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
import bcrypt from 'bcrypt'

dotenv.config();

/**
* @function Validates a user's session, this session is received via the authorization header and should be a valid jsonwebtoken.
* @param {Request} req - Request object containing information from the http request.
* @param {Response} res - Response object that will be populated with data and sent in response to the http request.
* @param {NextFunction} next - Triggers the next middleware event to occur before ending the current process.
* @returns {void}
*/
export async function validateUserSession(req, res, next) {
    const { authorization: jwtToken } = req.headers;
    if (!jwtToken) {
        res.status(403).json("User session invalid!");
        return;
    };

    try {
        // If the authentication header is valid then an attempt is made to validate the
        // received jwt token.

        const decodedUserSession = jwt.verify(jwtToken, process.env.JWT_KEY);

        // If the jwt is validated, the user's information is stored in the user property for access in the next middleware function.
        req.user = decodedUserSession;

        // If the session is validated and no errors occurred, then the next middleware or endpoint is called.
        await next();
    } catch (error) {
        // Logs any error to the console and sends a 500 status to indicate an error on the server's end.
        console.log(error)
        res.status(401).json(`Failed to validate user session!\n ${error.message}`);
    }
}

/**
* @function Registers a user's account and stores their username and hashed password in the project's database.
* @param {Request} req - Request object containing information from the http request.
* @param {Response} res - Response object that will be populated with data and sent in response to the http request.
* @param {NextFunction} next - Triggers the next middleware event to occur before ending the current process.
* @returns {void}
*/
export async function registerUser(req, res, next) {
    try {
        const { userName, userKey } = req.body;
    
        if ( !userName || !userKey ) {
            res.status(401).json("Invalid username or userkey entered!");
            return;
        };

        // Defines the number of cost factor for hashing the password, as of now around 1000 attempts are made to hash the password
        const saltRound = 10;

        const hashedUserKey = await bcrypt.hash(userKey, saltRound);

        // Uses a query to insert the new user information into the users table and stores the user's
        // new info into a user variable.
        const [user] = await req.db.query(
            `INSERT INTO users (user_name, user_key) 
            VALUES (:userName, :hashedUserKey)`,
            {
                userName,
                hashedUserKey
            }
        );

        // The information in the user variable is then used to generate a json web token which is returned
        // in the http response to provide the user with a valid user session that will last one day.
        const validatedSession = jwt.sign(
            // Assigns the user's name and the user's database id to the token.
            { userID: user.insertId, userName },
            process.env.JWT_KEY,
            // Denotes the token to be valid for only 24 hours.
            {expiresIn: "24h"}
        );

        // Sends the valid user session back in the http response along with a validation message.
        res.status(200).json({jwt: validatedSession, success: true, message: "User successfully register."});
    } catch (error) {
        // Logs any error to the console and sends a 500 status to indicate an error on the server's end.
        console.log(error);
        res.status(403).send(`Failed to validate user session!\n ${error.message}`);
    }
}

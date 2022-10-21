# kvapi-server
Server that provides a CRUD API for key-value storage with authentication, authorization and optional end-to-end encryption

## Requirements
* Node.js 14+

## Installation - option 1 (repository)
```
git clone https://github.com/wpazderski/kvapi-server
npm install
npm run build
```

## Installation - option 2 (npm package)
```
npm i @wpazderski/kvapi-server
```

## Configuration
Create a configuration file `.env`. These are the available variables and their default values:
```c
// Whether to use dev mode; if enabled:
// - debug messages will be written to stdout,
// - additional endpoints will be available (for testing).
// Don't use dev mode in production environments!
KVAPI_DEV_MODE=0

// See "Custom DB engine" section
KVAPI_DB_ENGINE=Level

// The server will listen on this port
KVAPI_PORT=23501

// Path to SSL certificate *.key file
KVAPI_SSL_KEY_FILE_PATH=ssl-certs/cert.key

// Path to SSL certificate *.crt file
KVAPI_SSL_CRT_FILE_PATH=ssl-certs/cert.crt

// Path where api endpoints will be available.
// With this example configuration endpoint
// "app-info" will be available at https://localhost:23501/api/app-info.
KVAPI_API_BASE_URL=/api/

// Path where static content will be served.
// With this example configuration: https://localhost:23501/.
KVAPI_STATIC_BASE_URL=/

// Path to static content (e.g. directory with index.html)
KVAPI_STATIC_PATH=../kvapi-client/example/

// Max number of private entries per user.
KVAPI_PRIVATE_DB_MAX_NUM_ENTRIES=100000

// Max size of all private entries (key+value) in bytes (per user).
// Multipliers: K=1024, M=1024*1024, G=1024*1024*1024.
KVAPI_PRIVATE_DB_MAX_SIZE=1G

// Max size of entry values in bytes.
// Multipliers: K=1024, M=1024*1024, G=1024*1024*1024.
KVAPI_VALUE_MAX_SIZE=8M

// Whether to disable /public-entries API
KVAPI_DISABLE_PUBLIC_ENTRIES=0

// Sessions will be terminated after KVAPI_SESSION_MAX_INACTIVITY_TIME of inactivity.
// Available units: ms (milliseconds), s(seconds), m(inutes), h(ours), d(ays), w(eeks), y(ears).
KVAPI_SESSION_MAX_INACTIVITY_TIME=1h
```
* To disable serving static content set `KVAPI_STATIC_BASE_URL` or `KVAPI_STATIC_PATH` to an empty string.
* If SSL `.key` or `.crt` file doesn't exist, server will be started in HTTP mode and "HTTPS is disabled" message will be written to stdout.

## Starting the server (installed from repository)
You can use one of the following commands to start the server:
```
npm start
// or:
node ./dist/start.js
```
However, it's recommended to use `systemd` or similar software to start services.

## Starting the server (installed via npm)
To start the server you need to run your own script similar to `start.ts` e.g.:
```ts
import { App } from "@wpazderski/kvapi-server";

App.create().then(app => {
    // Custom endpoints can be placed here
    return app.start();
});
```

## Development
### Compilation
```
// Build once:
npm run build
// or use watch mode:
npm run watch
```

### Custom DB engine
Kvapi server uses [Level](https://github.com/Level/abstract-level) DB. You can replace it with a DB of your choice e.g. MongoDB:
1. Create file `src/db/engines/YourDbName.ts` analogous to `src/db/engines/Level.ts`.
1. Add export to `src/db/engines/index.ts`.
1. Set `KVAPI_DB_ENGINE` in `.env` file.

### Custom endpoints
1. Create file in `src/api/` directory analogous to e.g. `src/api/Users.ts`.
1. Add export to `src/api/index.ts`.
1. Register your endpoint in `registerEndpointGroups()` method in `src/api/Api.ts`.

### Testing
There are end-to-end tests in [kvapi-tests](https://github.com/wpazderski/kvapi-tests) repository.

## Client
### JavaScript / TypeScript
See [kvapi-client](https://github.com/wpazderski/kvapi-client).

### Other languages
To use other languages with kvapi server you need to create your own client library that will:
* communicate with the server (REST api is documented below),
* manage session (unless authorization/authentication is not needed),
* encrypt and decrypt data (unles E2EE is not needed).

## REST API
Requests and responses are JSON strings.
### Error response
If a request fails:
* reponse status code will be set to one of numbers available in `src/errors/StatusTexts.ts`,
* response body will be empty or it will be a JSON string with error details.
### GET /app-info
Request:
```ts
{}
```
Response:
```ts
{
    // Whether dev mode is enabled (see configuration - .env file)
    devMode: boolean;
    
    // Whether at least one user is in the database
    hasAnyUsers: boolean;
    
    // Session will be terminated after this time since last activity.
    // Unit: milliseconds.
    sessionMaxInactivityTime: number;
    
    // Max size of entry values in bytes.
    valueMaxSize: number;
    
    // Max number of private entries per user.
    privateDbMaxNumEntries: number;
    
    // Max size of all private entries (key+value) in bytes (per user).
    privateDbMaxSize: number;
    
    // Whether /public-entries API is disabled
    disablePublicEntries: boolean;
}
```

### POST /batch
This route can be used to perform many operations in a single HTTP request.
* /sessions requests should not be batched.

Request:
```ts
{
    batchedRequests: Array<{
        method: "get" | "post" | "patch" | "put" | "delete";
        url: string; // Request URL e.g. /api/get-info
        data?: any; // Request body (optional - depends on url and method)
    }>;
}
```
Response:
```ts
{
    batchedResponses: Array<{
        // HTTP response status code e.g. 200 or 404;
        // see src/errors/StatusTexts.ts for complete list of status codes and texts
        statusCode: number;
        
        // HTTP response status message e.g. "OK" or "Not Found"
        statusText: string;
        
        // Response JSON string;
        // if an error occurs it will be an empty string or a JSON string with error details
        response: string;
    }>;
}
```
* Both `batchedRequests` and `batchedResponses` are arrays. They contain the same number of elements and `batchedResponses[i]` corresponds to `batchedRequests[i]`.
* Errors in batchedRequests do not affect other batchedRequests.

### *-entries
There are two groups of key-value endpoints:
* public-entries: single shared DB, available to everyone (no auth required),
* private-entries: one private DB for each user,
Both groups of key-value endpoints use identical API.
* Length of keys is limited to 1-1024 characters.
* Length of values is limited by setting in `.env` file.
/public-eentries API can be disabled (see `.env` file documentation).

### GET /*-entries
(GET /public-entries, GET /private-entries)

Returns all entries.

Request:
```ts
{}
```
Response:
```ts
{
    entries: {
        [key: string]: string;
    };
}
```

### GET /*-entries/`:key`
Returns entry with `:key`.

Request:
```ts
{}
```
Response:
```ts
{
    value: string;
}
```

### PUT /*-entries/`:key`
Creates or updates entry with `:key:`.

Request:
```ts
{
    value: string;
}
```
Response:
```ts
{}
```

### DELETE /*-entries/`:key`
Deletes entry with `:key:`.

Request:
```ts
{}
```
Response:
```ts
{}
```

### POST /sessions
Creates a session if user login and password are correct ("login").

Request:
```ts
{
    userLogin: string;
    userPassword: string;
}
```
Response:
```ts
{
    // Session ID; will be automatically used in future requests to authenticate the user
    id: data.session.Id;
    
    // Current user
    user: {
        // User ID (random string)
        id: data.user.Id;
        
        // User's login
        login: string;
        
        // "authorized" or "admin" (regular user or admin)
        role: data.user.Role;
        
        // String with user's private data;
        // encrypted JSON string with user's private key;
        // used internally by the client API
        privateData: data.user.PrivateData | null;
        
        // Value returned by Date.now() when the user updated their password;
        // 0 if user has never changed their password (still uses temporary password)
        lastPasswordUpdateTimestamp: number;
    },
}
```
* `kvapi-session-id` header should be set to Session ID in all future requests to authenticate the user.

### PATCH /sessions
Updates session last activity time ("heartbeat").
* Can be used to prevent session termination due to user inactivity.
* Can't be called if there is no active session.
* All API calls update session last activity time, so `PATCH /sessions` is not needed when user is making requests.

Request:
```ts
{}
```
Response:
```ts
{}
```

### DELETE /sessions
Terminates current session ("logout").

Request:
```ts
{}
```
Response:
```ts
{}
```

### /users
Users API is available only to admins except `GET /useers/:userId` and `PATCH /users/:usersId` endpoints that are available also for regular users if their user ID is equal to `:userId` param.

### GET /users
Returns list of all users.

Request:
```ts
{}
```
Response:
```ts
{
    users: Array<{
        id: string;
        login: string;
        role: "authorized" | "admin"; // Regular user or admin
    }>;
}
```

### GET /users/`:userId`
Returns specified user.

Request:
```ts
{}
```
Response if `userId` is someone else's user ID:
```ts
{
    user: {
        // User ID (random string)
        id: data.user.Id;
        
        // User's login
        login: string;
        
        // "authorized" or "admin" (regular user or admin)
        role: data.user.Role;
    };
}
```
Response if `userId` is own user ID:
```ts
{
    user: {
        id: data.user.Id;
        login: string;
        role: data.user.Role;
        
        // String with user's private data;
        // encrypted JSON string with user's private key;
        // used internally by the client API
        privateData: data.user.PrivateData | null;
        
        // Value returned by Date.now() when the user updated their password;
        // 0 if user has never changed their password (still uses temporary password)
        lastPasswordUpdateTimestamp: number;
    };
}
```

### POST /users
Creates a new user.

Request:
```ts
{
    login: string; // 1-128 characters, unique
    password: string; // 1-128 characters (server doesn't check password strength)
    role: "authorized" | "admin"; // Regular user or admin
}
```
Response:
```ts
{
    user: {
        id: string;
        login: string;
        role: "authorized" | "admin"; // Regular user or admin
    };
}
```

### PATCH /users/`:userId`
Updates specified user.
* Use only properties that are supposed to change (other won't be modified).
* Changing own `role` is not allowed.
* Changing someone else's `password` is not allowed.
* Changing someone else's `privateData` is not allowed.
* Length of `privateData` is limited to `KVAPI_VALUE_MAX_SIZE` setting (see `.env` file).

Request:
```ts
{
    login?: string; // 1-128 characters, unique
    password?: string; // 1-128 characters (server doesn't check password strength)
    role?: "authorized" | "admin"; // Regular user or admin
    privateData?: string | null; // User's private data; only own privateData can be updated
}
```
Response if `userId` is someone else's user ID:
```ts
{
    user: {
        // User ID (random string)
        id: data.user.Id;
        
        // User's login
        login: string;
        
        // "authorized" or "admin" (regular user or admin)
        role: data.user.Role;
    };
}
```
Response if `userId` is own user ID:
```ts
{
    user: {
        id: data.user.Id;
        login: string;
        role: data.user.Role;
        
        // String with user's private data;
        // encrypted JSON string with user's private key;
        // used internally by the client API
        privateData: data.user.PrivateData | null;
        
        // Value returned by Date.now() when the user updated their password;
        // 0 if user has never changed their password (still uses temporary password)
        lastPasswordUpdateTimestamp: number;
    };
}
```

### DELETE /users/`:userId`
Deletes specified user. Deleting self is not allowed.

Request:
```ts
{}
```
Response:
```ts
{}
```

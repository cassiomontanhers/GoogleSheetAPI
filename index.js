const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/drive'];

async function getSpreadsheetInit(params, callbackRoute){
  await fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    authorize(JSON.parse(content), getSpreadsheet, callbackRoute, params);
  });
}

async function createNewSpreadsheetInit(params, callbackRoute){
    getNewToken(createNewSheet, callbackRoute, params);
}

async function answerFormInit(params, callbackRoute){
  await fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    authorize(JSON.parse(content), addNewRowToSheet, callbackRoute, params);
  });
}

async function authenticateCode(callback){
  await fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);

    var credentials = JSON.parse(content);

    const {client_secret, client_id, redirect_uris} = credentials.web;
    oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });
    callback(authUrl);
  });
}


const express = require('express')
const app = express()
const bodyParser = require('body-parser');
const port = 4000
const https = require('https');


var path = require('path');
app.use(bodyParser.urlencoded({ extended: false }));
app.set('view engine', 'ejs');


var formsInfoMap = new Map();
var code = null;

function init(){
}

app.get('/', (req, res) => res.render('index'));

app.get('/listForms', function(req, res) {
  try {
    res.render('forms', {forms: formsInfoMap});
  } catch (e) {
    console.log(e);
  }
});

app.get('/getForm', function(req, res) {
  var params = {formId: req.query.key}
  try {
    const result = getSpreadsheetInit(params, function (dataInfo){
      res.render('form', {info: dataInfo});
    });
  } catch (e) {
    next(e)
  }
});

app.post('/createForm', function(req, res) {
  var title = req.body.title;
  var params = {title : title};
  try {
    const result = createNewSpreadsheetInit(params, function (dataInfo){
      res.render('confirmation', {info: dataInfo});
    });
  } catch (e) {
    next(e)
  }
});

app.get('/createNewForm', function(req, res) {
    if(!req.query.code){
      res.render('index');
    }else{
      code = req.query.code;
      res.render('createForm');
    }
});

app.get('/authenticate', function(req, res) {
  try{
    authenticateCode((authUrl) => {res.redirect(authUrl);});
  }catch(e){
    console.log(e);
  }
});

app.post('/answerForm', function(req, res) {
  var formId = req.body.key;
  var formName = req.body.title;
  console.log(req.body);
  var values = {name : req.body.name,
                age : req.body.age,
                size : req.body.size};
  var params = {formId: formId, formName: formName, values: values};
  try {
    const result = answerFormInit(params ,function (dataInfo){
      res.render('confirmationAnswer', {info: dataInfo});
    });
  } catch (e) {
    next(e)
  }
});

app.use( function(req, res, next) {
    res.render('index');
});

app.listen(port, () => console.log(`Assignment5 app listening on port ${port}.`))



function authorize(credentials, callback, callbackRoute, params) {
  console.log(params);
  const {client_secret, client_id, redirect_uris} = credentials.web;
  oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  oAuth2Client.setCredentials(formsInfoMap.get(params.formId).token);
  callback(oAuth2Client, callbackRoute, params);
}

function getNewToken(callback, callbackRoute, params) {
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error while trying to retrieve access token', err);
      oAuth2Client.setCredentials(token);
      callback(oAuth2Client, callbackRoute, params, token);
    });
}

function createNewSheet(auth, callbackRoute, params, token){
  const sheets = google.sheets({version: 'v4', auth});
  const resource = {
    properties: {
      title: params.title,
    },
  };
  sheets.spreadsheets.create({
    resource,
    fields: 'spreadsheetId',
  }, (err, spreadsheet) =>{
    if (err) {
      console.log(err);
    } else {
      console.log(`createNewSheet Success`);
      initNewSheet(auth,spreadsheet.data['spreadsheetId'], params.title, callbackRoute, token);
    }
  });
}

function initNewSheet(auth, spreadsheetId, title, callbackRoute, token){
  const sheets = google.sheets({version: 'v4', auth});
  let range = "A1:A3";
  let valueInputOption = "RAW";
  let values = [
    [
      "NAME","AGE","SHOE SIZE"
    ],
  ];
  let resource = {
    values,
  };
  sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption,
    resource,
  }, (err, result) => {
    if (err) {
      console.log(err);
    } else {
      console.log("initNewSheet Success");
      id = result.data['spreadsheetId'];
      var info = [
              { name: title , sheetId: spreadsheetId },
          ]
      formsInfoMap.set(id, {auth: auth, name: title, token: token});
      code = null;
      callbackRoute(info);
    }
  });
}

function addNewRowToSheet(auth, callbackRoute, params){
  var spreadsheetId = params.formId;
  const sheets = google.sheets({version: 'v4', auth});
  let range = "Sheet1";
  let valueInputOption = "RAW";
  let values = [
    [
      params.values.name,params.values.age,params.values.size
    ],
  ];
  let resource = {
    values,
  };
  sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption,
    resource,
  }, (err, result) => {
    if (err) {
      console.log(err);
    } else {
      console.log("addNewRowToSheet Success");
      info = [{id : result.data.spreadsheetId, name: params.formName}];
      callbackRoute(info);
    }
  });
}


function getSpreadsheet(authClient, callbackRoute, params) {
  const sheets = google.sheets({version: 'v4', authClient});
  spreadsheetId = params.formId;
  var request = {
    spreadsheetId: spreadsheetId,
    ranges: [],
    includeGridData: false,
    auth: authClient,
  };
  sheets.spreadsheets.get(request, function(err, response) {
    if (err) {
      console.error(err);
      return;
    }
    var returnValue = JSON.stringify(response, null, 2);
    var form = [
            { name: response.data['properties']['title'] , id: response.data['spreadsheetId'] },
        ];
    callbackRoute(form);
  });
};

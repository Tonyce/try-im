#!/usr/bin/env node
var args = process.argv.slice(2);
var WebSocketClient = require('websocket').client;

var client = new WebSocketClient();

client.on('connectFailed', function(error) {
    console.log('Connect Error: ' + error.toString());
});

client.on('connect', function(connection) {
    console.log('WebSocket Client Connected');
    connection.on('error', function(error) {
        console.log("Connection Error: " + error.toString());
    });
    connection.on('close', function() {
        console.log('echo-protocol Connection Closed');
    });
    connection.on('message', function(message) {
        // console.log("message")
        if (message.type === 'utf8') {
            console.log("Received: '" + message.utf8Data + "'");
        }
    });

    function sendNumber() {
        if (connection.connected) {
            var number = Math.round(Math.random() * 0xFFFFFF);
            var message = {
                to: {
                    id: args[1]
                },
                form: {
                    id: args[0]
                },
                content: number.toString()
            }
            
            connection.sendUTF(JSON.stringify(message));
            setTimeout(sendNumber, 1000);
        }
    }

    if (args[0] !== '11' ) {
        sendNumber();    
    }
    
});

client.connect('ws://localhost:8080/'+args[0], 'echo-protocol');
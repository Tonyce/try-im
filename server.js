#!/usr/bin/env node

var amqp = require('amqplib/callback_api');
var WebSocketServer = require('websocket').server;
var http = require('http');

global._MQConn = '';

amqp.connect('amqp://localhost', function(err, conn) {
    global._MQConn = conn;
    conn.on('close', function () {
        global._MQConn = '';
    })
});

var server = http.createServer(function(request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    // response.writeHead(404);
    response.end("hello");
});

server.listen(8080, function() {
    console.log((new Date()) + ' Server is listening on port 8080');
});

wsServer = new WebSocketServer({
    httpServer: server,
    autoAcceptConnections: false
});

wsServer.on('request', function(request) {

    var connection = request.accept('echo-protocol', request.origin);
    var id = request.resourceURL.path.replace('/', '');

    consumeToClient(connection, id);
    
    connection.on('message', function(message) {
        // console.log("message", message);
        pushToMQ(message);
    });
    connection.on('close', function(reasonCode, description) {
        //stopConsume
        connection.MQChannel && connection.MQChannel.close();
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
    });
});

//emit to mq
function pushToMQ (message) {
    // console.log(typeof message)
    var data = ''
    if (message.type === 'utf8') {
        data = message.utf8Data;
    } else if (message.type === 'binary') {
        data = message.binaryData;
    }
    data = JSON.parse(data)
    var _ch = ""
    var MQConn = global._MQConn;
    var ex = 'direct_message';
    var severity = `${data.to.id}`
    
    if (!MQConn) {
        console.log("MQConn closed");
        return;
    }

    message = JSON.stringify(message);
    if (_ch) {
        _ch.assertExchange(ex, 'direct', {durable: true});
        _ch.publish(ex, severity, new Buffer(message), {persistent: true});
    }else {
        MQConn.createChannel(function(err, ch) {
            _ch = ch
            ch.assertExchange(ex, 'direct', {durable: true});
            ch.publish(ex, severity, new Buffer(message), {persistent: true});
        });
    }
}

//consume mq
function consumeToClient (connection, id) {
    
    var MQConn = global._MQConn;
    var _ch = "";
    
    if (!MQConn) {
        console.log("MQConn closed");
        return;
    }

    var ex = 'direct_message';
    var severity = `${id}`

    if (_ch) {
        consume(_ch)
    }else {
        MQConn.createChannel(function(err, ch) {
            _ch = ch
            consume(_ch)
        });
    }

    function consume(_ch) {
        connection.MQChannel = _ch;

        _ch.assertExchange(ex, 'direct', {durable: true});

        _ch.assertQueue('', {exclusive: true}, function(err, q) {
            _ch.bindQueue(q.queue, ex, severity);
            _ch.consume(q.queue, function(msg) {
                var message = msg.content.toString();
                    message = JSON.parse(message);
                // console.log("consumeing", message);
                if (message.type === 'utf8') {
                    // console.log('Received Message: ' + message.utf8Data);
                    connection.sendUTF(message.utf8Data);
                } else if (message.type === 'binary') {
                    // console.log('Received Binary Message of ' + message.binaryData.length + ' bytes');
                    connection.sendBytes(message.binaryData);
                }
            }, {noAck: true});
        });
    }
}
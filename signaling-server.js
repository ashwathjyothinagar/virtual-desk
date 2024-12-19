// signalingServer.js
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

// Track operators and call queue
let operators = [];
let callQueue = [];

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    const data = JSON.parse(message);

    if (data.type === 'registerOperator') {
      registerOperator(ws, data.operatorId);
    } else if (data.type === 'call') {
      handleCall(ws, data.hotelId);
    } else if (data.type === 'acceptCall') {
      acceptCall(data.operatorId);
    } else if (data.type === 'toggleAvailability') {
      toggleOperatorAvailability(data.operatorId);
    } else if (data.type === 'signal') {
      forwardSignal(data.to, data.payload);
    }
  });

  ws.on('close', () => {
    operators = operators.filter((op) => op.ws !== ws);
  });
});

function registerOperator(ws, operatorId) {
  operators.push({ id: operatorId, available: true, ws });
  console.log(`Operator ${operatorId} registered.`);
}

function handleCall(hotelWs, hotelId) {
  const availableOperator = operators.find((op) => op.available);
  if (availableOperator) {
    availableOperator.available = false;
    availableOperator.hotelWs = hotelWs;
    availableOperator.ws.send(JSON.stringify({ type: 'incomingCall', hotelId }));
  } else {
    callQueue.push({ hotelWs, hotelId });
  }
}

function acceptCall(operatorId) {
  const operator = operators.find((op) => op.id === operatorId);
  if (operator && operator.hotelWs) {
    operator.hotelWs.send(JSON.stringify({ type: 'callStart', operatorId }));
    operator.ws.send(JSON.stringify({ type: 'callStart', hotelId: operator.hotelWs.hotelId }));
    operator.hotelWs = null; // Clear hotel reference
  }
}

function toggleOperatorAvailability(operatorId) {
  const operator = operators.find((op) => op.id === operatorId);
  if (operator) {
    operator.available = !operator.available;
    console.log(`Operator ${operatorId} is now ${operator.available ? 'available' : 'unavailable'}`);
  }
}

function forwardSignal(to, payload) {
  const recipient = operators.find((op) => op.id === to) || callQueue.find((call) => call.hotelId === to);
  if (recipient && recipient.ws) {
    recipient.ws.send(JSON.stringify({ type: 'signal', payload }));
  }
}


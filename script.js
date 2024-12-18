const signalingServer = new WebSocket('wss://virtual-desk-xf5i.onrender.com');


// Select video elements
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startCallButton = document.getElementById('startCall');

// Variables for WebRTC
let localStream;
let remoteStream;
let peerConnection;

// WebSocket signaling server

signalingServer.onmessage = async (event) => {
  const message = await parseMessage(event.data);
  if (!message) return;

  const { type, payload } = message;

  if (type === 'offer') {
    await handleOffer(payload);
  } else if (type === 'answer') {
    await handleAnswer(payload);
  } else if (type === 'candidate') {
    await handleCandidate(payload);
  }
};

// Helper to parse WebSocket messages
async function parseMessage(data) {
  if (data instanceof Blob) {
    const text = await data.text();
    return JSON.parse(text);
  }
  try {
    return JSON.parse(data);
  } catch (error) {
    console.error('Invalid JSON message:', data, error);
    return null;
  }
}

// ICE server configuration
const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

// Start local video stream
async function startLocalVideo() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;

    peerConnection = new RTCPeerConnection(configuration);

    localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

    remoteStream = new MediaStream();
    peerConnection.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => remoteStream.addTrack(track));
      remoteVideo.srcObject = remoteStream;
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        signalingServer.send(JSON.stringify({ type: 'candidate', payload: event.candidate }));
      }
    };
  } catch (error) {
    console.error('Error accessing media devices.', error);
  }
}

// Create and send an offer
async function callUser() {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  signalingServer.send(JSON.stringify({ type: 'offer', payload: offer }));
}

// Handle incoming offer
async function handleOffer(offer) {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  signalingServer.send(JSON.stringify({ type: 'answer', payload: answer }));
}

// Handle incoming answer
async function handleAnswer(answer) {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

// Handle incoming ICE candidate
async function handleCandidate(candidate) {
  await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
}

// Start call button event listener
startCallButton.addEventListener('click', callUser);

// Start local video stream on page load
startLocalVideo();

const recordCallButton = document.getElementById('recordCall');

// Variables for recording
let mediaRecorder;
let recordedChunks = [];

// Handle recording
recordCallButton.addEventListener('click', () => {
  if (recordCallButton.textContent === 'Start Recording') {
    startRecording();
    recordCallButton.textContent = 'Stop Recording';
  } else {
    stopRecording();
    recordCallButton.textContent = 'Start Recording';
  }
});

// Start recording the call
function startRecording() {
  if (!localStream || !remoteStream) {
    console.error('Local or remote stream is not available.');
    return;
  }

  // Combine local and remote streams
  const combinedStream = new MediaStream();
  localStream.getTracks().forEach((track) => combinedStream.addTrack(track));
  remoteStream.getTracks().forEach((track) => combinedStream.addTrack(track));

  // Initialize MediaRecorder
  try {
    mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm' });

    // Capture data chunks
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    // Handle recording stop
    mediaRecorder.onstop = saveRecording;

    // Start recording
    mediaRecorder.start();
    console.log('Recording started.');
  } catch (error) {
    console.error('Error initializing MediaRecorder:', error);
  }
}

// Stop recording
function stopRecording() {
  if (mediaRecorder) {
    mediaRecorder.stop();
    console.log('Recording stopped.');
  }
}

// Save the recorded video
function saveRecording() {
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);

  // Create a download link
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = `recording-${Date.now()}.webm`;
  document.body.appendChild(a);
  a.click();

  // Cleanup
  URL.revokeObjectURL(url);
  recordedChunks = [];
}

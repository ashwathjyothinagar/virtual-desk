const signalingServer = new WebSocket('wss://virtual-desk-xf5i.onrender.com');

// Select video elements
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startCallButton = document.getElementById('startCall');

// Variables for WebRTC
let localStream;
let remoteStream;
let peerConnection;

signalingServer.onmessage = async (message) => {
  const data = JSON.parse(message.data);

  if (data.type === 'offer') {
    await handleOffer(data.offer);
  } else if (data.type === 'answer') {
    await handleAnswer(data.answer);
  } else if (data.type === 'candidate') {
    await handleCandidate(data.candidate);
  }
};

// ICE server configuration
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }, // Google STUN server
  ],
};

// Start local video stream
async function startLocalVideo() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;

    // Set up RTCPeerConnection
    peerConnection = new RTCPeerConnection(configuration);

    // Add local stream to the connection
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    // Handle remote stream
    remoteStream = new MediaStream();
    peerConnection.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track);
      });
      remoteVideo.srcObject = remoteStream;
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        signalingServer.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
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
  signalingServer.send(JSON.stringify({ type: 'offer', offer: offer }));
}

// Handle incoming offer
async function handleOffer(offer) {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  signalingServer.send(JSON.stringify({ type: 'answer', answer: answer }));
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
startCallButton.addEventListener('click', () => {
  callUser();
});

// Start local video stream on page load
startLocalVideo();

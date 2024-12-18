const signalingServer = new WebSocket('ws://192.168.1.6:8080');
let localStream;
let peerConnection;
let mediaRecorder;
let recordedChunks = [];

const startCallButton = document.getElementById('startCall');
const localVideo = document.getElementById('localVideo');
const remoteVideos = document.getElementById('remoteVideos');
const muteAudioButton = document.getElementById('muteAudio');
const stopVideoButton = document.getElementById('stopVideo');
const startRecordingButton = document.getElementById('startRecording');
const stopRecordingButton = document.getElementById('stopRecording');

// Start Call
startCallButton.addEventListener('click', async () => {
  document.querySelector('.home-screen').hidden = true;
  document.querySelector('.video-call-screen').hidden = false;

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  peerConnection = new RTCPeerConnection();
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  peerConnection.ontrack = event => {
    const remoteVideo = document.createElement('video');
    remoteVideo.srcObject = event.streams[0];
    remoteVideo.autoplay = true;
    remoteVideos.appendChild(remoteVideo);
  };

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      signalingServer.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
    }
  };

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  signalingServer.send(JSON.stringify({ type: 'offer', offer }));
});

signalingServer.onmessage = async message => {
  const data = JSON.parse(message.data);

  if (data.type === 'offer') {
    await peerConnection.setRemoteDescription(data.offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    signalingServer.send(JSON.stringify({ type: 'answer', answer }));
  } else if (data.type === 'answer') {
    await peerConnection.setRemoteDescription(data.answer);
  } else if (data.type === 'candidate') {
    await peerConnection.addIceCandidate(data.candidate);
  }
};

// Mute Audio
muteAudioButton.addEventListener('click', () => {
  localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0].enabled;
  muteAudioButton.textContent = localStream.getAudioTracks()[0].enabled ? 'Mute' : 'Unmute';
});

// Stop Video
stopVideoButton.addEventListener('click', () => {
  localStream.getVideoTracks()[0].enabled = !localStream.getVideoTracks()[0].enabled;
  stopVideoButton.textContent = localStream.getVideoTracks()[0].enabled ? 'Stop Video' : 'Start Video';
});

// Start Recording
startRecordingButton.addEventListener('click', () => {
  mediaRecorder = new MediaRecorder(localStream);
  recordedChunks = [];
  mediaRecorder.ondataavailable = event => {
    if (event.data.size > 0) recordedChunks.push(event.data);
  };
  mediaRecorder.start();
  startRecordingButton.disabled = true;
  stopRecordingButton.disabled = false;
});

// Stop Recording
stopRecordingButton.addEventListener('click', () => {
  mediaRecorder.stop();
  startRecordingButton.disabled = false;
  stopRecordingButton.disabled = true;

  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.textContent = 'Download Recording';
    a.download = `recording-${Date.now()}.webm`;
    document.body.appendChild(a);
  };
});

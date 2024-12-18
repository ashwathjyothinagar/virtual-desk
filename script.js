const signalingServer = new WebSocket('wss://virtual-desk-xf5i.onrender.com');

let localStream, remoteStream, peerConnection, mediaRecorder, recordedChunks = [];

    const localVideo = document.getElementById('localVideo');
    const remoteVideo = document.getElementById('remoteVideo');
    const startCallButton = document.getElementById('startCall');
    const startRecordingButton = document.getElementById('startRecording');
    const stopRecordingButton = document.getElementById('stopRecording');

    const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

    startCallButton.onclick = async () => {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideo.srcObject = localStream;

      peerConnection = new RTCPeerConnection(configuration);

      // Add local stream tracks to the connection
      localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

      // Handle incoming remote stream
      peerConnection.ontrack = (event) => {
        remoteStream = event.streams[0];
        remoteVideo.srcObject = remoteStream;
        console.log('Remote stream received.');
      };

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          signalingServer.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
        }
      };

      signalingServer.onmessage = async (message) => {
        const data = JSON.parse(message.data);

        if (data.type === 'offer') {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          signalingServer.send(JSON.stringify({ type: 'answer', answer }));
        } else if (data.type === 'answer') {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        } else if (data.type === 'candidate') {
          await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      signalingServer.send(JSON.stringify({ type: 'offer', offer }));
    };

    startRecordingButton.onclick = () => {
      if (!localStream || !remoteStream) {
        alert('Both local and remote streams must be available to record.');
        return;
      }

      const combinedStream = new MediaStream([
        ...localStream.getTracks(),
        ...remoteStream.getTracks(),
      ]);

      mediaRecorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm' });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = saveRecording;

      mediaRecorder.start();
      console.log('Recording started.');
    };

    stopRecordingButton.onclick = () => {
      mediaRecorder.stop();
      console.log('Recording stopped.');
    };

    function saveRecording() {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const formData = new FormData();
      formData.append('video', blob, `recording-${Date.now()}.webm`);

      fetch('/upload', {
        method: 'POST',
        body: formData,
      })
        .then((response) => {
          if (response.ok) {
            console.log('Recording uploaded successfully.');
            alert('Recording uploaded successfully!');
          } else {
            console.error('Failed to upload recording.');
            alert('Failed to upload recording.');
          }
        })
        .catch((error) => {
          console.error('Error uploading recording:', error);
          alert('Error uploading recording.');
        });

      recordedChunks = [];
    }
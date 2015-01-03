// //// Set up sockets ////

// var socket = io();
// $('form').submit(function() {
//   socket.emit('chat message', $('#m').val());
//   $('#m').val('');
//   return false;
// });
// socket.on('chat message', function(msg) {
//   $('#messages').append($('<li>').text(msg));
// });

// //// Set up local video stream ////

// navigator.getUserMedia = navigator.getUserMedia ||
//   navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

// var constraints = {
//   video: true
// };

// function successCallback(stream) {
//   window.stream = stream; // global variable available to console
//   var video = document.querySelector("video");
//   video.src = window.URL.createObjectURL(stream);
//   video.play();
// }

// function errorCallback(error) {
//   console.log("navigator.getUserMedia error: ", error);
// }

// navigator.getUserMedia(constraints, successCallback, errorCallback);

// 'use strict';

// var localStream, localPeerConnection, remotePeerConnection;

// var localVideo = document.getElementById("localVideo");
// var remoteVideo = document.getElementById("remoteVideo");

// var startButton = document.getElementById("startButton");
// var callButton = document.getElementById("callButton");
// var hangupButton = document.getElementById("hangupButton");

// startButton.disabled = false;
// callButton.disabled = true;
// hangupButton.disabled = true;

// startButton.onclick = start;
// callButton.onclick = call;
// hangupButton.onclick = hangup;

// function trace(text) {
//   console.log((performance.now() / 1000).toFixed(3) + ": " + text);
// }

// function gotStream(stream){
//   trace("Received local stream");
//   localVideo.src = URL.createObjectURL(stream);
//   localStream = stream;
//   callButton.disabled = false;
// }

// function start() {
//   trace("Requesting local stream");
//   startButton.disabled = true;
//   getUserMedia({audio:true, video:true}, gotStream,
//     function(error) {
//       trace("getUserMedia error: ", error);
//     });
// }

// function call() {
//   callButton.disabled = true;
//   hangupButton.disabled = false;
//   trace("Starting call");

//   if (localStream.getVideoTracks().length > 0) {
//     trace('Using video device: ' + localStream.getVideoTracks()[0].label);
//   }
//   if (localStream.getAudioTracks().length > 0) {
//     trace('Using audio device: ' + localStream.getAudioTracks()[0].label);
//   }

//   var servers = null;

//   localPeerConnection = new RTCPeerConnection(servers);
//   trace("Created local peer connection object localPeerConnection");
//   localPeerConnection.onicecandidate = gotLocalIceCandidate;

//   remotePeerConnection = new RTCPeerConnection(servers);
//   trace("Created remote peer connection object remotePeerConnection");
//   remotePeerConnection.onicecandidate = gotRemoteIceCandidate;
//   remotePeerConnection.onaddstream = gotRemoteStream;

//   localPeerConnection.addStream(localStream);
//   trace("Added localStream to localPeerConnection");
//   localPeerConnection.createOffer(gotLocalDescription,handleError);
// }

// function gotLocalDescription(description){
//   localPeerConnection.setLocalDescription(description);
//   trace("Offer from localPeerConnection: \n" + description.sdp);
//   remotePeerConnection.setRemoteDescription(description);
//   remotePeerConnection.createAnswer(gotRemoteDescription,handleError);
// }

// function gotRemoteDescription(description){
//   remotePeerConnection.setLocalDescription(description);
//   trace("Answer from remotePeerConnection: \n" + description.sdp);
//   localPeerConnection.setRemoteDescription(description);
// }

// function hangup() {
//   trace("Ending call");
//   localPeerConnection.close();
//   remotePeerConnection.close();
//   localPeerConnection = null;
//   remotePeerConnection = null;
//   hangupButton.disabled = true;
//   callButton.disabled = false;
// }

// function gotRemoteStream(event){
//   remoteVideo.src = URL.createObjectURL(event.stream);
//   trace("Received remote stream");
// }

// function gotLocalIceCandidate(event){
//   if (event.candidate) {
//     remotePeerConnection.addIceCandidate(new RTCIceCandidate(event.candidate));
//     trace("Local ICE candidate: \n" + event.candidate.candidate);
//   }
// }

// function gotRemoteIceCandidate(event){
//   if (event.candidate) {
//     localPeerConnection.addIceCandidate(new RTCIceCandidate(event.candidate));
//     trace("Remote ICE candidate: \n " + event.candidate.candidate);
//   }
// }

// function handleError(){}



'use strict';

/****************************************************************************
 * Initial setup
 ****************************************************************************/

var configuration = {
  'iceServers': [{
    'url': 'stun:stun.l.google.com:19302'
  }]
},
  // {'url':'stun:stun.services.mozilla.com'}

  roomURL = document.getElementById('url'),
  video = document.querySelector('video'),
  photo = document.getElementById('photo'),
  photoContext = photo.getContext('2d'),
  trail = document.getElementById('trail'),
  snapBtn = document.getElementById('snap'),
  sendBtn = document.getElementById('send'),
  snapAndSendBtn = document.getElementById('snapAndSend'),
  // Default values for width and height of the photoContext.
  // Maybe redefined later based on user's webcam video stream.
  photoContextW = 300,
  photoContextH = 150;

// Attach even handlers
video.addEventListener('play', setCanvasDimensions);
snapBtn.addEventListener('click', snapPhoto);
sendBtn.addEventListener('click', sendPhoto);
snapAndSendBtn.addEventListener('click', snapAndSend);

// Create a random room if not already present in the URL.
var isInitiator;
var room = window.location.hash.substring(1);
if (!room) {
  room = window.location.hash = randomToken();
}


/****************************************************************************
 * Signaling server
 ****************************************************************************/

// Connect to the signaling server
var socket = io.connect();

socket.on('ipaddr', function(ipaddr) {
  console.log('Server IP address is: ' + ipaddr);
  updateRoomURL(ipaddr);
});

socket.on('created', function(room, clientId) {
  console.log('Created room', room, '- my client ID is', clientId);
  isInitiator = true;
  grabWebCamVideo();
});

socket.on('joined', function(room, clientId) {
  console.log('This peer has joined room', room, 'with client ID', clientId);
  isInitiator = false;
  grabWebCamVideo();
});

socket.on('full', function(room) {
  alert('Room ' + room + ' is full. We will create a new room for you.');
  window.location.hash = '';
  window.location.reload();
});

socket.on('ready', function() {
  createPeerConnection(isInitiator, configuration);
});

socket.on('log', function(array) {
  console.log.apply(console, array);
});

socket.on('message', function(message) {
  console.log('Client received message:', message);
  signalingMessageCallback(message);
});

// Join a room
socket.emit('create or join', room);

if (location.hostname.match(/localhost|127\.0\.0/)) {
  socket.emit('ipaddr');
}

/**
 * Send message to signaling server
 */
function sendMessage(message) {
  console.log('Client sending message: ', message);
  socket.emit('message', message);
}

/**
 * Updates URL on the page so that users can copy&paste it to their peers.
 */
function updateRoomURL(ipaddr) {
  var url;
  if (!ipaddr) {
    url = location.href;
  } else {
    url = location.protocol + '//' + ipaddr + ':2013/#' + room;
  }
  roomURL.innerHTML = url;
}


/****************************************************************************
 * User media (webcam)
 ****************************************************************************/

function grabWebCamVideo() {
  console.log('Getting user media (video) ...');
  getUserMedia({
    video: true
  }, getMediaSuccessCallback, getMediaErrorCallback);
}

function getMediaSuccessCallback(stream) {
  var streamURL = window.URL.createObjectURL(stream);
  console.log('getUserMedia video stream URL:', streamURL);
  window.stream = stream; // stream available to console

  video.src = streamURL;
  show(snapBtn);
}

function getMediaErrorCallback(error) {
  console.log('getUserMedia error:', error);
}


/****************************************************************************
 * WebRTC peer connection and data channel
 ****************************************************************************/

var peerConn;
var dataChannel;

function signalingMessageCallback(message) {
  if (message.type === 'offer') {
    console.log('Got offer. Sending answer to peer.');
    peerConn.setRemoteDescription(new RTCSessionDescription(message), function() {},
      logError);
    peerConn.createAnswer(onLocalSessionCreated, logError);

  } else if (message.type === 'answer') {
    console.log('Got answer.');
    peerConn.setRemoteDescription(new RTCSessionDescription(message), function() {},
      logError);

  } else if (message.type === 'candidate') {
    peerConn.addIceCandidate(new RTCIceCandidate({
      candidate: message.candidate
    }));

  } else if (message === 'bye') {
    // TODO: cleanup RTC connection?
  }
}

function createPeerConnection(isInitiator, config) {
  console.log('Creating Peer connection as initiator?', isInitiator, 'config:',
    config);
  peerConn = new RTCPeerConnection(config);

  // send any ice candidates to the other peer
  peerConn.onicecandidate = function(event) {
    console.log('onIceCandidate event:', event);
    if (event.candidate) {
      sendMessage({
        type: 'candidate',
        label: event.candidate.sdpMLineIndex,
        id: event.candidate.sdpMid,
        candidate: event.candidate.candidate
      });
    } else {
      console.log('End of candidates.');
    }
  };

  if (isInitiator) {
    console.log('Creating Data Channel');
    dataChannel = peerConn.createDataChannel('photos');
    onDataChannelCreated(dataChannel);

    console.log('Creating an offer');
    peerConn.createOffer(onLocalSessionCreated, logError);
  } else {
    peerConn.ondatachannel = function(event) {
      console.log('ondatachannel:', event.channel);
      dataChannel = event.channel;
      onDataChannelCreated(dataChannel);
    };
  }
}

function onLocalSessionCreated(desc) {
  console.log('local session created:', desc);
  peerConn.setLocalDescription(desc, function() {
    console.log('sending local desc:', peerConn.localDescription);
    sendMessage(peerConn.localDescription);
  }, logError);
}

function onDataChannelCreated(channel) {
  console.log('onDataChannelCreated:', channel);

  channel.onopen = function() {
    console.log('CHANNEL opened!!!');
  };

  channel.onmessage = (webrtcDetectedBrowser === 'firefox') ?
    receiveDataFirefoxFactory() :
    receiveDataChromeFactory();
}

function receiveDataChromeFactory() {
  var buf, count;

  return function onmessage(event) {
    if (typeof event.data === 'string') {
      buf = window.buf = new Uint8ClampedArray(parseInt(event.data));
      count = 0;
      console.log('Expecting a total of ' + buf.byteLength + ' bytes');
      return;
    }

    var data = new Uint8ClampedArray(event.data);
    buf.set(data, count);

    count += data.byteLength;
    console.log('count: ' + count);

    if (count === buf.byteLength) {
      // we're done: all data chunks have been received
      console.log('Done. Rendering photo.');
      renderPhoto(buf);
    }
  };
}

function receiveDataFirefoxFactory() {
  var count, total, parts;

  return function onmessage(event) {
    if (typeof event.data === 'string') {
      total = parseInt(event.data);
      parts = [];
      count = 0;
      console.log('Expecting a total of ' + total + ' bytes');
      return;
    }

    parts.push(event.data);
    count += event.data.size;
    console.log('Got ' + event.data.size + ' byte(s), ' + (total - count) +
      ' to go.');

    if (count === total) {
      console.log('Assembling payload');
      var buf = new Uint8ClampedArray(total);
      var compose = function(i, pos) {
        var reader = new FileReader();
        reader.onload = function() {
          buf.set(new Uint8ClampedArray(this.result), pos);
          if (i + 1 === parts.length) {
            console.log('Done. Rendering photo.');
            renderPhoto(buf);
          } else {
            compose(i + 1, pos + this.result.byteLength);
          }
        };
        reader.readAsArrayBuffer(parts[i]);
      };
      compose(0, 0);
    }
  };
}


/****************************************************************************
 * Aux functions, mostly UI-related
 ****************************************************************************/

function snapPhoto() {
  photoContext.drawImage(video, 0, 0, photoContextW, photoContextH);
  show(photo, sendBtn);
}

function sendPhoto() {
  // Split data channel message in chunks of this byte length.
  var CHUNK_LEN = 64000;

  var img = photoContext.getImageData(0, 0, photoContextW, photoContextH),
    len = img.data.byteLength,
    n = len / CHUNK_LEN | 0;

  console.log('Sending a total of ' + len + ' byte(s)');
  dataChannel.send(len);

  // split the photo and send in chunks of about 64KB
  for (var i = 0; i < n; i++) {
    var start = i * CHUNK_LEN,
      end = (i + 1) * CHUNK_LEN;
    console.log(start + ' - ' + (end - 1));
    dataChannel.send(img.data.subarray(start, end));
  }

  // send the reminder, if any
  if (len % CHUNK_LEN) {
    console.log('last ' + len % CHUNK_LEN + ' byte(s)');
    dataChannel.send(img.data.subarray(n * CHUNK_LEN));
  }
}

function snapAndSend() {
  snapPhoto();
  sendPhoto();
}

function renderPhoto(data) {
  var canvas = document.createElement('canvas');
  canvas.classList.add('incomingPhoto');
  trail.insertBefore(canvas, trail.firstChild);

  var context = canvas.getContext('2d');
  var img = context.createImageData(photoContextW, photoContextH);
  img.data.set(data);
  context.putImageData(img, 0, 0);
}

function setCanvasDimensions() {
  if (video.videoWidth === 0) {
    setTimeout(setCanvasDimensions, 200);
    return;
  }

  console.log('video width:', video.videoWidth, 'height:', video.videoHeight);

  photoContextW = video.videoWidth / 2;
  photoContextH = video.videoHeight / 2;
  //photo.style.width = photoContextW + 'px';
  //photo.style.height = photoContextH + 'px';
  // TODO: figure out right dimensions
  photoContextW = 300; //300;
  photoContextH = 150; //150;
}

function show() {
  Array.prototype.forEach.call(arguments, function(elem) {
    elem.style.display = null;
  });
}

function hide() {
  Array.prototype.forEach.call(arguments, function(elem) {
    elem.style.display = 'none';
  });
}

function randomToken() {
  return Math.floor((1 + Math.random()) * 1e16).toString(16).substring(1);
}

function logError(err) {
  console.log(err.toString(), err);
}

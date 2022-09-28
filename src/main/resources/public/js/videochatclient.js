//username
var name;
var connectedUser;

//******
//UI selectors block
//******
var loginPage = document.querySelector('#loginPage');
var usernameInput = document.querySelector('#usernameInput');
var loginBtn = document.querySelector('#loginBtn');

var callPage = document.querySelector('#callPage');
var callToUsernameInput = document.querySelector('#callToUsernameInput');
var callBtn = document.querySelector('#callBtn');

var hangUpBtn = document.querySelector('#hangUpBtn');

var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');

var peerConn;
var stream;

var constraints = {
   mandatory: {"offerToReceiveAudio":true,"offerToReceiveVideo":true}
};

callPage.style.display = "none";

//connecting to our signaling server
var webSocket = new WebSocket("ws://" + location.hostname + ":" + location.port + "/chat/");

webSocket.onopen = function () {
   console.log("Connected to the signaling server");
};

webSocket.oniceconnectionstatechange = function(e) {
   console.log("ICE State has changed.");
   onIceStateChange(connection, e);
};

webSocket.onerror = function (err) {
   console.log("Got WebSocket error", err);
};

//when we got a message from a signaling server
webSocket.onmessage = function (msg) {
   console.log(msg.data);
   if(msg.data === "Connection Established"){
	   return;
   }

   var data = JSON.parse(msg.data);

   switch(data.type) {
      case "login":
         handleLogin(data.success);
         break;
      //when somebody wants to call us
      case "offer":
         handleOffer(data.offer, data.name);
         break;
      case "answer":
         handleAnswer(data.answer);
         break;
      //when a remote peer sends an ice candidate to us
      case "candidate":
         handleCandidate(data.candidate);
         break;
      case "leave":
         handleLeave();
         break;
      default:
         break;
   }
};

//alias for sending JSON encoded messages
function send(message) {
   //attach the other peer username to our messages
   if (connectedUser) {
      message.name = callToUsernameInput.value;
   }
   webSocket.send(JSON.stringify(message));
};

// Login when the user clicks the button
loginBtn.addEventListener("click", function (event) {
   name = usernameInput.value;
   if (name.length > 0) {
      send({
         type: "login",
         name: name
      });
   }
});

// call start() to initiate
function start(){
   //**********************
   //Starting a peer connection
   //**********************
   //using Google public stun server
   var servers = {
      iceServers: [
         { url:'stun:numb.viagenie.ca:3478', credential:'', username:'' },
         { url:'stun:stun.l.google.com:19302' },
         { url:'stun:stun2.1.google.com:19302' },
         { url:'stun:23.21.150.121' },
         { url:'turn:numb.viagenie.ca:3478', credential:'', username:'' },
         { url:'turn:192.158.29.39:3478?transport=udp', credential:'', username:'' },
         { url:'turn:192.158.29.39:3478?transport=tcp', credential:'', username:'' }
      ]
   };
   peerConn = new mozRTCPeerConnection(servers, {optional: [{RtpDataChannels: true}]});
   console.log("Peer Connection State: "+peerConn.signalingState || peerConn.readyState);
   //peerConn.setConfiguration(servers);
   //console.log(peerConn.iceConnectionState);
   //console.log("RTCPeerConnection object was created");

   // Setup ice handling
   peerConn.onicecandidate = function (event) {
      if (event.candidate) {
         console.info("The ICE candidate (transport address: '" + event.candidate.candidate + "') has been added to this connection.");
         send({
            type: "candidate",
            candidate: event.candidate,
            name: callToUsernameInput.value
         });
      }
   };

   peerConn.onidentityresult = function( ev ) {
      console.info("A new identity assertion (blob: '" + ev.assertion + "') has been generated.");
   }

   peerConn.onidpassertionerror = function( ev ) {
      console.info("The idp named '" + ev.idp + "' encountered an error " + "while generating an assertion.");
   }

   // let the 'negotiationneeded' event trigger offer generation
   /*peerConn.onnegotiationneeded = function () {
      peerConn.createOffer(localDescCreated, logError);
   }*/

   //when a remote user adds stream to the peer connection, we display it
   peerConn.onaddstream = function (media) {
      console.info("A stream (id: '" + media.stream.id + "') has been added to this connection.");
      remoteVideo.src = window.URL.createObjectURL(media.stream);
   };

   //getting local video stream
   navigator.mozGetUserMedia({
      'audio': true,
      'video': true
   }, function (myStream) {
      stream = myStream;
      //displaying local video stream on the page
      localVideo.src = window.URL.createObjectURL(stream);
      // setup stream listening
      peerConn.addStream(stream);
   }, logError);

   peerConn.onsignalingstatechange = stateCallback;

   peerConn.oniceconnectionstatechange = iceStateCallback;
}

function iceStateCallback() {
   var iceState;
   if (peerConn) {
      iceState = peerConn.iceConnectionState;
      console.log('peerConn ICE connection state change callback, state: ' + iceState);
   }
}

function stateCallback() {
   var state;
   if (peerConn) {
      state = peerConn.signalingState || peerConn.readyState;
      console.log('peerConn state change callback, state: ' + state);
   }
}

function handleLogin(success) {
   if (success === false) {
      alert("Ooops...try a different username");
   } else {
      loginPage.style.display = "none";
      callPage.style.display = "block";
      start();
   }
};

//initiating a call
callBtn.addEventListener("click", function () {
   var callToUsername = callToUsernameInput.value;

   if (callToUsername.length > 0) {
      connectedUser = callToUsername;
      //start();
      // create an offer
      //creatingOffer();
      /*peerConn.createOffer({"iceRestart": true}).then(function(offer) {
         peerConn.setLocalDescription(offer, function() {
            // send the offer to a server to be forwarded to the friend you're calling.
            console.info("Creating Offer.");
            send({
               type: "offer",
               offer: offer
            });
         }, logError);
      }, logError);*/
      peerConn.createOffer(function (offer) {
         peerConn.setLocalDescription(offer);
         send({
            type: "offer",
            offer: offer
         });
      }, logError, constraints);
   }
});

function creatingOffer() {
   var off;
   peerConn.createOffer({"iceRestart": true}).then(function(offer) {
      off = offer;
      return peerConn.setLocalDescription(offer);
   }).then(function() {
      // send the offer to the other peer using the signaling server
      send({
         type: "offer",
         offer: off
      });
   }).catch(logError);
}

function localDescCreated(desc) {
   peerConn.setLocalDescription(desc, function () {
      send({
         type: "sdp",
         offer: peerConn.localDescription
      });
   }, logError);
}

//when somebody sends us an offer
function handleOffer(offer, name) {
   connectedUser = callToUsernameInput.value;
   //start();
   //create an answer to an offer
   peerConn.setRemoteDescription(new RTCSessionDescription(offer), function() {
      peerConn.createAnswer(function(answer) {
         peerConn.setLocalDescription(answer, function() {
            // send the answer to a server to be forwarded back to the caller (you)
            send({
               type: "answer",
               answer: answer,
               name: callToUsernameInput.value
            });
         }, logError);
      }, logError, constraints);
   }, logError);

   /*peerConn.setRemoteDescription(new RTCSessionDescription(offer));
   peerConn.createAnswer(function (answer) {
      console.info("Creating Answer.");
      peerConn.setLocalDescription(answer);
      send({
         type: "answer",
         answer: answer,
         name: callToUsernameInput.value
      });
   }, logError, constraints);*/
};

//when we got an answer from a remote user
function handleAnswer(answer) {
   peerConn.setRemoteDescription(new RTCSessionDescription(answer));
}

//when we got an ice candidate from a remote user
function handleCandidate(candidate) {
   peerConn.addIceCandidate(new RTCIceCandidate(candidate)).then(
       onAddIceCandidateSuccess,
       onAddIceCandidateError
   );
}

function onAddIceCandidateSuccess() {
   console.info('AddIceCandidate success.');
}

function onAddIceCandidateError(error) {
   console.info('Failed to add Ice Candidate: ' + error.toString());
}

//hang up
hangUpBtn.addEventListener("click", function () {
   console.info("Leaving ...");
   send({
      type: "leave"
   });
   //handleLeave();
});

function handleLeave() {
   connectedUser = null;
   remoteVideo.src = null;
   peerConn.close();
   peerConn.onicecandidate = null;
   peerConn.onaddstream = null;
}

function logError(error) {
   console.error(error);
}

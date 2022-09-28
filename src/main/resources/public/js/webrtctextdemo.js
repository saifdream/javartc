var name; 
var connectedUser; 

var webSocket = new WebSocket("wss://" + location.hostname + ":" + location.port + "/chat/");

webSocket.onopen = function () {
   console.log("Connected to the signaling server");
};

webSocket.onerror = function (err) {
   console.log("Got error", err); 
}; 

webSocket.onmessage = function (msg) {
   console.log("Got message", msg.data); 
   if(msg.data === "Connection Established"){
	   return;
   }
   var data = JSON.parse(msg.data);
   delete data.name;
   switch(data.type) { 
      case "login": 
         handleLogin(data.success); 
         break; 
      //when somebody wants to call us 
      case "offer":
         delete data.type;
         console.log(data);
         handleOffer(data.offer, data.name); 
         break; 
      case "answer":
         delete data.type;
         console.log(data);
         handleAnswer(data.answer); 
         break; 
      //when a remote peer sends an ice candidate to us 
      case "candidate":
         delete data.type;
         console.log(data);
         handleCandidate(data.candidate); 
         break; 
      case "leave":
         delete data.type;
         console.log(data);
         handleLeave(); 
         break; 
      default: 
         break; 
   } 
}; 

//alias for sending JSON encoded messages 
function send(message) {
   if (connectedUser) {
      message.name = callToUsernameInput.value;
   }
   webSocket.send(JSON.stringify(message));
};
 
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
var msgInput = document.querySelector('#msgInput'); 
var sendMsgBtn = document.querySelector('#sendMsgBtn'); 

var chatArea = document.querySelector('#chatarea');

var STUN = { urls:'stun:numb.viagenie.ca:3478', credential:'n15255161525516', username:'saif89.2012@gmail.com' };

var TURN = { urls:'turn:numb.viagenie.ca:3478', credential:'n15255161525516', username:'saif89.2012@gmail.com' };

var iceServers = { iceServers: [ STUN, TURN ] };

// DTLS/SRTP is preferred on chrome to interop with Firefox which supports them by default
var DtlsSrtpKeyAgreement = { DtlsSrtpKeyAgreement: true };
var RtpDataChannels = { RtpDataChannels: true };
var optional = { optional: [RtpDataChannels] };

var peerConnection = "";

var dataChannel;
var receiveChannel;

window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
window.RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;
window.RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;
window.URL = window.URL || window.webkitURL || window.msURL || window.mozURL;

callPage.style.display = "none";

var browser;
function browserChecker() {
   if((navigator.userAgent.indexOf("Opera") || navigator.userAgent.indexOf('OPR')) != -1 ) {
      browser = "Opera";
   } else if(navigator.userAgent.indexOf("Chrome") != -1 ) {
      browser = "Chrome";
   } else if(navigator.userAgent.indexOf("Safari") != -1) {
      browser = "Safari";
   } else if(navigator.userAgent.indexOf("Firefox") != -1 ) {
      browser = "Firefox";
   } else if((navigator.userAgent.indexOf("MSIE") != -1 ) || (!!document.documentMode == true )) { //IF IE > 10
      browser = "IE";
   } else if (document.documentMode || /Edge/.test(navigator.userAgent)) { // detect IE8 and above, and edge
      browser = "Edge";
   } else {
      browser = "unknown";
   }
   return browser;
}

loginBtn.addEventListener("click", function (event) { 
   name = usernameInput.value; 
	
   if (name.length > 0) {
      send({ 
         type: "login", 
         name: name 
      }); 
   } 
	
});
 
function handleLogin(success) { 

   if (success === false) {
      alert("Ooops... Try a different username");
   } else { 
      loginPage.style.display = "none"; 
      callPage.style.display = "block";

      peerConnection = new RTCPeerConnection(iceServers, optional);

      /*if(browserChecker() === "Firefox"){
         peerConnection = new mozRTCPeerConnection(iceServers, optional);
      }

      if(browserChecker() === "Chrome"){
         peerConnection = new webkitRTCPeerConnection(iceServers, optional);
      }*/

      if (peerConnection) {console.log("RTCPeerConnection object was created")}

      peerConnection.ondatachannel = function(event) {
         receiveChannel = event.channel;
         receiveChannel.onmessage = function(event){
            //document.querySelector("div#chatarea").innerHTML = event.data;
            chatArea.innerHTML += callToUsernameInput.value + ": " + event.data + "<br />";
         };
      };

      //creating data channel
      dataChannel = peerConnection.createDataChannel("sendDataChannel", {reliable:false});
      dataChannel.onerror = function (error) { console.log("Ooops...error:", error) };
      //when we receive a message from the other peer, display it on the screen
      dataChannel.onmessage = function (event) { chatArea.innerHTML += callToUsernameInput.value + ": " + event.data + "<br />"; };
      dataChannel.onclose = function () { console.log("data channel is closed") };

      peerConnection.onicecandidate = function(event) {
         var candidate = event.candidate;
         if(typeof candidate == 'undefined') { console.error("Candidate is undefined.") }
         if(event.candidate) {
            send({
               type: "candidate",
               candidate: event.candidate,
               name: callToUsernameInput.value
            });
         }
      };

      peerConnection.ongatheringchange =  function(e) {
         if (e.currentTarget && e.currentTarget.iceGatheringState === 'complete') {
            console.log("e.currentTarget && e.currentTarget.iceGatheringState complete'");
         }
      };

      peerConnection.onidentityresult = function( ev ) {
         console.info("A new identity assertion (blob: '" + ev.assertion + "') has been generated.");
      }

      peerConnection.onidpassertionerror = function( ev ) {
         console.info("The idp named '" + ev.idp + "' encountered an error " + "while generating an assertion.");
      }

      peerConnection.onsignalingstatechange = stateCallback;
      peerConnection.oniceconnectionstatechange = iceStateCallback;
   } 
};

function iceStateCallback() {
   var iceState;
   if (peerConnection) {
      iceState = peerConnection.iceConnectionState;
      console.info('peer ICE connection state change callback, state: ' + iceState);
   }
}

function stateCallback() {
   var state;
   if (peerConnection) {
      state = peerConnection.signalingState || peerConnection.readyState;
      console.info('peer state change callback, state: ' + state);
   }
}

webSocket.oniceconnectionstatechange = function(e) {
    onIceStateChange(webSocket, e);
    console.log("ICE State has changed.")
};

callBtn.addEventListener("click", function () { 
   var callToUsername = callToUsernameInput.value; 
	
   if (callToUsername.length > 0) { 
      connectedUser = callToUsername;
      peerConnection.createOffer().then(function (offer) {
         console.log('peer setLocalDescription start');
         return peerConnection.setLocalDescription(offer).then(
             function () {
                onSetLocalSuccess();
             }, onSetSessionDescriptionError
         );
      }).then(function () {
         send({
            type: "offer",
            offer: peerConnection.localDescription,
            name: callToUsernameInput.value
         });
      }).catch(function (reason) {
         console.error("An error occurred, so handle the failure to connect: " + reason);
      });
      /*var offersdp;
      peerConnection.createOffer().then(function(offer) {
         offersdp = offer;
         return peerConnection.setLocalDescription(offer, successCallback, failureCallback);
      })
      .then(function() {
         setTimeout(send({
            type: "offer",
            offer: offersdp //peerConnection.localDescription
         }),3000);
      })
      .catch(function(reason) {
         // An error occurred, so handle the failure to connect
         console.error("An error occurred, so handle the failure to connect: "+reason);
      });*/
      //var offersdp;
      /*peerConnection.createOffer().then(function(offer) {
         //offersdp = offer;
         console.log('peer setLocalDescription start')
         console.log('offer: '+offer)
         return peerConnection.setLocalDescription(offer).then(
             function() {
                onSetLocalSuccess();
             }, onSetSessionDescriptionError
         );
      }).then(function() {
         send({
            type: "offer",
            offer: peerConnection.localDescription,
            name: callToUsernameInput.value
         });
      }).catch(function(reason) {
         console.error("An error occurred, so handle the failure to connect: "+reason);
      });*/
   } 
	
});
 
//when somebody sends us an offer 
function handleOffer(offer, name) {
   // remote-descriptions should be set earlier
   // using offer-sdp provided by the offerer
   /*var remoteDescription = new RTCSessionDescription(offer);
   peerConnection.setRemoteDescription(remoteDescription, successCallback, failureCallback);*/
   connectedUser = callToUsernameInput.value;
   console.log('setRemoteDescription start');
   peerConnection.setRemoteDescription(new RTCSessionDescription(offer), function() {
      console.log('peer createAnswer start');
      peerConnection.createAnswer(function(answer) {
         peerConnection.setLocalDescription(answer, function() {
            console.log('setLocalDescription start');
            // send the answer to a server to be forwarded back to the caller (you)
            send({
               type: "answer",
               answer: peerConnection.localDescription,
               name: callToUsernameInput.value
            });
         }, onSetSessionDescriptionError);
      }, creatingAnswerFailure);
   }, onSetSessionDescriptionError);
   /*peerConnection.setRemoteDescription(new RTCSessionDescription(offer.sdp)).then(function() {
      onSetRemoteSuccess();
   },onSetSessionDescriptionError);*/

   /*peerConnection.setRemoteDescription(offer.sdp, function () {
      // if we received an offer, we need to answer
      //if (peerConnection.remoteDescription.type == 'offer')
         //peerConnection.createAnswer(localDescCreated, logError);
         peerConnection.createAnswer().then(function(answer) {
            //answersdp = answer;
            console.log('peerConnection setLocalDescription start');
            console.log('answer: '+answer)
            return peerConnection.setLocalDescription(answer).then(
                function() {
                   onSetLocalSuccess();
                }, onSetSessionDescriptionError
            );
         },failureCallback, sdpConstraints).then(function() {
            send({
               type: "answer",
               answer: peerConnection.localDescription, //peerConnection.localDescription
               name: callToUsernameInput.value
            });
         }).catch(function(reason) {
            console.error("An error occurred, so handle the failure to connect: "+reason);
         });
   }, onSetSessionDescriptionError);*/

   /*var answersdp;
   peerConnection.createAnswer().then(function(answer) {
       answersdp = answer;
       return peerConnection.setLocalDescription(answer, successCallback, failureCallback);
    })
    .then(function() {
       setTimeout(send({
          type: "answer",
          answer: answersdp,
          name: callToUsernameInput.value
       }),3000);
    })
    .catch(function(reason) {
       console.error("An error occurred, so handle the failure to connect: "+reason);
    });*/
   //var answersdp;
   /*peerConnection.createAnswer().then(function(answer) {
      //answersdp = answer;
      console.log('peerConnection setLocalDescription start');
      console.log(answer)
      return peerConnection.setLocalDescription(answer).then(
          function() {
             onSetLocalSuccess();
          }, onSetSessionDescriptionError
      );
   },failureCallback, sdpConstraints).then(function() {
      send({
         type: "answer",
         answer: peerConnection.localDescription //peerConnection.localDescription
         //name: callToUsernameInput.value
      });
   }).catch(function(reason) {
      console.error("An error occurred, so handle the failure to connect: "+reason);
   });*/
}
 
//when we got an answer from a remote user 
function handleAnswer(answer) {
   /*var remoteDescription = new RTCSessionDescription(answer);
   peerConnection.setRemoteDescription(remoteDescription, successCallback, failureCallback);*/

   //console.log('Answer from peer:\n' + answer.sdp);
   console.log('peer setRemoteDescription start');

   peerConnection.setRemoteDescription(new RTCSessionDescription(answer),successCallback,failureCallback);

   /*peerConnection.setRemoteDescription(answer.sdp, function () {
      // if we received an offer, we need to answer
      successCallback();
   }, failureCallback);*/

   /*peerConnection.setRemoteDescription(new RTCSessionDescription(answer.sdp)).then(
       function() {
          successCallback();
       }, failureCallback
   );*/
}

function successCallback() {
   console.info('Peer Description success.');
}

function failureCallback(error) {
   console.error('Peer Description Failed: ' + error.toString());
}

function creatingAnswerFailure(error) {
   console.error('Creating Answer Failed: ' + error.toString());
}

function onCreateSessionDescriptionError(error) {
   console.error('Failed to create session description: ' + error.toString());
}

function onSetLocalSuccess() {
   console.log('SetLocalDescription complete');
}

function onSetRemoteSuccess() {
   console.log('SetRemoteDescription complete');
}

function onSetSessionDescriptionError(error) {
   console.error('Failed to set session description: ' + error.toString());
}
 
//when we got an ice candidate from a remote user 
function handleCandidate(candidate) {
   /*peerConnection.addIceCandidate(new RTCIceCandidate(candidate),onAddIceCandidateSuccess, onAddIceCandidateError)
       .then().catch(function(reason) {
      console.error("Error: Failure during addIceCandidate() and reason: "+reason);
   });*/

   peerConnection.addIceCandidate(
       new RTCIceCandidate(candidate)
   ).then(
       function() {
          onAddIceCandidateSuccess();
       },
       function(err) {
          onAddIceCandidateError(err);
       }
   );
   //console.log(' ICE candidate: \n' + candidate.candidate);
}

function onAddIceCandidateSuccess() {
   console.info('AddIceCandidate success.');
}

function onAddIceCandidateError(error) {
   console.error('Failed to add Ice Candidate: ' + error.toString());
}
 
//hang up 
hangUpBtn.addEventListener("click", function () { 
   send({ 
      type: "leave" 
   }); 
	
   handleLeave(); 
}); 

function handleLeave() { 
   connectedUser = null; 
   peerConnection.close();
   peerConnection.onicecandidate = null;
};
 
//when user clicks the "send message" button 
sendMsgBtn.addEventListener("click", function (event) { 
   var msg = msgInput.value;
   chatArea.innerHTML += name + ": " + msg + "<br />";
	
   //sending a message to a connected peer 
   dataChannel.send(msg);
   msgInput.value = ""; 
});
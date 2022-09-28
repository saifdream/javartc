import org.eclipse.jetty.websocket.api.Session;
import org.eclipse.jetty.websocket.api.annotations.*;

import javax.json.Json;
import javax.json.JsonObject;
import java.io.IOException;
import java.io.StringReader;
import java.util.Arrays;

/**
 * Created by saif-dream on 7/14/2016.
 */
@WebSocket
public class ChatWebSocketHandler {

    //private String sender, msg;

    @OnWebSocketConnect
    public void onConnect(Session user) throws Exception {
        //String username = "User" + Main.nextUserNumber++;
        //Main.userUsernameMap.put(user, username);
        //Main.broadcastMessage(sender = "Server", msg = (username + " joined the chat"));
        try {
            user.getRemote().sendString("Connection Established");
        } catch (IOException ex) {
            ex.printStackTrace();
        }
    }

    @OnWebSocketClose
    public void onClose(Session user, int statusCode, String reason) {
        //String username = Main.userUsernameMap.get(user);
        //Main.userUsernameMap.remove(user);
        //Main.broadcastMessage(sender = "Server", msg = (username + " left the chat"));
        try {
            if(user.isOpen())
                user.getRemote().sendString("Connection Closed.");
        } catch (IOException ex) {
            ex.printStackTrace();
        }
    }

    @OnWebSocketError
    public void onError(Session user, Throwable t) { //Session user, int statusCode, String reason
        try {
            System.out.println("Error: " + t.getMessage());
            if(user.isOpen()) {
                user.getRemote().sendString("Error: " + t.getMessage());
            }
            Main.sessionUserMap.values().remove(user);
        } catch (IOException ex) {
            ex.printStackTrace();
        }
    }

    @OnWebSocketMessage
    public void onMessage(Session session, String message) {
        JsonObject o = Json.createReader(new StringReader(message)).readObject();
        String type = o.getString("type");
        if (type.equals("login")) {
            String name = o.getString("name");
            boolean found = Arrays.asList(Main.user).contains(name);
            if (!found) {
                try {
                    session.getRemote().sendString("{\"type\":\"login\",\"success\":" + false + "}");
                } catch (IOException e) {
                    e.printStackTrace();
                }
            } else {
                Main.sessionUserMap.put(name, session);
                try {
                    session.getRemote().sendString("{\"type\":\"login\",\"success\":" + true + "}");
                } catch (IOException e) {
                    e.printStackTrace();
                }
            }

        } else if (type.equals("offer") || type.equals("answer") || type.equals("candidate") || type.equals("leave")) {
            Main.sessionUserMap.entrySet().stream().filter(m -> m.getKey().equals(o.getString("name"))).forEach(m -> {
                Session targetUserSession = (Session) m.getValue();

                if (targetUserSession.isOpen()) {
                    try {
                        targetUserSession.getRemote().sendString(message);
                    } catch (IOException e) {
                        e.printStackTrace();
                    }
                }/* else {
                    try {
                        session.getRemote().sendString("Target user not available.");
                    } catch (IOException e) {
                        e.printStackTrace();
                    }
                }*/
            });
            /*for (Map.Entry m : Main.sessionUserMap.entrySet()) {
                if (m.getKey().equals(o.getString("name"))) {
                    Session targetUserSession = (Session) m.getValue();

                    if(targetUserSession.isOpen()){
                        try {
                            targetUserSession.getRemote().sendString(message);
                        } catch (IOException e) {
                            e.printStackTrace();
                        }
                    }
                }
            }*/

        } else {
            System.out.println("Session has ended.");
        }
        //Main.broadcastMessage(sender = Main.userUsernameMap.get(session), msg = message);
    }

}

import com.google.gson.Gson;
import org.eclipse.jetty.websocket.api.Session;
import org.eclipse.jetty.websocket.api.annotations.*;

import javax.json.Json;
import javax.json.JsonObject;
import java.io.IOException;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.Arrays;

/**
 * Created by saif-dream on 8/8/2016.
 */
@WebSocket
public class WebSocketServer {
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
            //System.out.println("Error: " + t.getMessage());
            if(user.isOpen()) {
                user.getRemote().sendString("Error: " + t.getMessage());
            }
            Main.sessionUserMap.values().remove(user);
        } catch (IOException ex) {
            ex.printStackTrace();
        }
    }

    @OnWebSocketMessage
    public void onMessage(Session session, String message) throws IOException {
        JsonObject o = Json.createReader(new StringReader(message)).readObject();
        String type = o.getString("type");
        if (type.equals("login")) {
            String name = o.getString("whoAmI");
            boolean found = Arrays.asList(Main.user).contains(name);
            if (found) {
                Main.sessionUserMap.put(name, session);
                try {
                    session.getRemote().sendString("{\"type\":\"login\",\"success\":" + true + "}");
                } catch (IOException e) {
                    e.printStackTrace();
                }
            } else {
                try {
                    session.getRemote().sendString("{\"type\":\"login\",\"success\":" + false + "}");
                } catch (IOException e) {
                    e.printStackTrace();
                }
            }

        } else if (type.equals("offer") || type.equals("answer") || type.equals("candidate") || type.equals("leave")) {
            Main.sessionUserMap.entrySet().stream().filter(m -> m.getKey().equals(o.getString("targetUser"))).forEach(m -> {
                Session targetUserSession = (Session) m.getValue();

                if (targetUserSession.isOpen()) {
                    try {
                        targetUserSession.getRemote().sendString(message);
                    } catch (IOException e) {
                        e.printStackTrace();
                    }
                }
            });
        } else if (type.equals("list")) {
            if(session.isOpen()) {
                String json = new Gson().toJson(new ArrayList<String>(Main.sessionUserMap.keySet()));
                session.getRemote().sendString("{\"type\":\"list\",\"userList\":" + json + "}");
            }
        }
    }
}

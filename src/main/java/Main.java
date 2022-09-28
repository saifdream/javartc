import org.eclipse.jetty.websocket.api.Session;
import spark.ModelAndView;
import spark.template.freemarker.FreeMarkerEngine;

import java.util.*;

import static spark.Spark.*;

public class Main {

    static String[] user = {"saif","khalid","dream","success","onus"};
    static Map<String, Session> sessionUserMap = Collections.synchronizedMap(new HashMap<String, Session>());

    //static Map<Session, String> userUsernameMap = new HashMap<>();
    //static int nextUserNumber = 1; //Assign to username for next connecting user

    //git push https://git.heroku.com/javartc.git master

    public static void main(String[] args) {

    port(Integer.valueOf(System.getenv("PORT")));
    staticFileLocation("/public");

    webSocket("/chat", ChatWebSocketHandler.class);
    webSocket("/videoChat", WebSocketServer.class);
    init();

    get("/hello", (req, res) -> "Hello World");

    get("/", (request, response) -> {
            Map<String, Object> attributes = new HashMap<>();
            attributes.put("message", "Hello World!");

            return new ModelAndView(attributes, "videochat.html");
        }, new FreeMarkerEngine());

    get("/test", (request, response) -> {
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("message", "Hello World!");

        return new ModelAndView(attributes, "test.html");
    }, new FreeMarkerEngine());

    get("/text", (request, response) -> {
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("message", "Hello World!");

        return new ModelAndView(attributes, "webrtctextdemo.html");
    }, new FreeMarkerEngine());

    get("/video", (request, response) -> {
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("message", "Welcome to Future technology WebRTC");

        ArrayList<String> userList = new ArrayList<String>(sessionUserMap.keySet());
        attributes.put("userList", userList);

        return new ModelAndView(attributes, "videoCallApp.html");
    }, new FreeMarkerEngine());

    /*get("/db", (req, res) -> {
      Connection connection = null;
      Map<String, Object> attributes = new HashMap<>();
      try {
        connection = DatabaseUrl.extract().getConnection();

        Statement stmt = connection.createStatement();
        stmt.executeUpdate("CREATE TABLE IF NOT EXISTS ticks (tick timestamp)");
        stmt.executeUpdate("INSERT INTO ticks VALUES (now())");
        ResultSet rs = stmt.executeQuery("SELECT tick FROM ticks");

        ArrayList<String> output = new ArrayList<String>();
        while (rs.next()) {
          output.add( "Read from DB: " + rs.getTimestamp("tick"));
        }

        attributes.put("results", output);
        return new ModelAndView(attributes, "db.ftl");
      } catch (Exception e) {
        attributes.put("message", "There was an error: " + e);
        return new ModelAndView(attributes, "error.ftl");
      } finally {
        if (connection != null) try{connection.close();} catch(SQLException e){}
      }
    }, new FreeMarkerEngine());*/

    }

    //Sends a message from one user to all users, along with a list of current usernames
    /*public static void broadcastMessage(String sender, String message) {
    userUsernameMap.keySet().stream().filter(Session::isOpen).forEach(session -> {
      try {
        session.getRemote().sendString(String.valueOf(new JSONObject()
                .put("userMessage", createHtmlMessageFromSender(sender, message))
                .put("userlist", userUsernameMap.values())
        ));
      } catch (Exception e) {
        e.printStackTrace();
      }
    });
    }*/

    //Builds a HTML element with a sender-name, a message, and a timestamp,
    /*private static String createHtmlMessageFromSender(String sender, String message) {
    return article().with(
            b(sender + " says:"),
            p(message),
            span().withClass("timestamp").withText(new SimpleDateFormat("HH:mm:ss").format(new Date()))
    ).render();
    }*/

}

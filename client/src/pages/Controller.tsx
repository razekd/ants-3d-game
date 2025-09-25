import { useEffect, useRef } from "react";
import io, { Socket } from "socket.io-client";
import { Joystick } from "react-joystick-component";

type JoystickEvent = {
  type: "move" | "stop" | "start";
  x: number | null;
  y: number | null;
  direction: "FORWARD" | "RIGHT" | "LEFT" | "BACKWARD" | null;
  distance: number | null;
};

export default function Controller() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!socketRef.current) {
      socketRef.current = io("http://localhost:4000", {
        transports: ["websocket"],
      });
    }

    const socket = socketRef.current;

    const handleConnect = () => {
      console.log("Connected to server with ID:", socket.id);
    };

    socket.on("connect", handleConnect);

    return () => {
      socket.off("connect", handleConnect);
    };
  }, []);

  const handleMove = (event: JoystickEvent) => {
    const x = event.x ?? 0;
    const y = -(event.y ?? 0); // Invert y-axis
    socketRef.current?.emit("input", { x, y });
  };

  const handleStop = () => {
    socketRef.current?.emit("input", { x: 0, y: 0 });
  };

  return (
    <div className="App" style={{ height: "100vh", background: "#eee" }}>
      <h2 style={{ textAlign: "center" }}>Joystick Controller</h2>
      <Joystick
        size={150}
        baseColor="lightgray"
        stickColor="black"
        move={handleMove}
        stop={handleStop}
      />
    </div>
  );
}

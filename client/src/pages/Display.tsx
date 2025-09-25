import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import * as CANNON from "cannon-es";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader";
import { io, Socket } from "socket.io-client";

const App = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");
  const sceneInitialized = useRef(false);
  const currentInputRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!mountRef.current || sceneInitialized.current) return;
    sceneInitialized.current = true;

    // --- Socket setup ---
    if (!socketRef.current) {
      socketRef.current = io("http://localhost:4000", {
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
    }
    const socket = socketRef.current;

    const handleConnect = () => {
      console.log("Connected to server with ID:", socket.id);
      setConnectionStatus("Connected");
    };

    const handleDisconnect = () => {
      console.log("Disconnected from server");
      setConnectionStatus("Disconnected");
    };

    const handleAllInputs = (
      allInputs: Record<string, { x: number; y: number }>
    ) => {
      let activeInput = { x: 0, y: 0 };
      for (const inputData of Object.values(allInputs)) {
        if (inputData.x !== 0 || inputData.y !== 0) {
          activeInput = inputData;
          break;
        }
      }
      // Invert the y value
      currentInputRef.current = { x: activeInput.x, y: activeInput.y };
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("allInputs", handleAllInputs);

    // --- Three.js setup ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      69,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(10, 10, 10);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // --- Light ---
    // const light = new THREE.DirectionalLight(0xffffff, 1);
    // light.position.set(10, 20, 10);
    // scene.add(light);

    // --- 3-Point Lighting System ---

    // 1. KEY LIGHT (Main light - brightest, creates primary shadows)
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(10, 15, 10);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 50;
    keyLight.shadow.camera.left = -20;
    keyLight.shadow.camera.right = 20;
    keyLight.shadow.camera.top = 20;
    keyLight.shadow.camera.bottom = -20;
    scene.add(keyLight);

    // 2. FILL LIGHT (Softer light to fill in shadows from key light)
    const fillLight = new THREE.DirectionalLight(0xb3d9ff, 1.0); // Slightly blue tint
    fillLight.position.set(-8, 10, 5);
    scene.add(fillLight);

    // 3. RIM LIGHT (Backlight to create separation and outline)
    const rimLight = new THREE.DirectionalLight(0xffeeaa, 1.2); // Warm tint
    rimLight.position.set(-5, 8, -10);
    scene.add(rimLight);

    // 4. AMBIENT LIGHT (Overall base illumination)
    const ambientLight = new THREE.AmbientLight(0x404080, 0.3); // Soft blue ambient
    scene.add(ambientLight);

    // Optional: Add point light for extra highlight on spaceship
    const accentLight = new THREE.PointLight(0x00ffff, 0.8, 30); // Cyan accent
    accentLight.position.set(0, 8, 8);
    scene.add(accentLight);

    // --- Ground plane (Three.js) ---
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x999999,
      side: THREE.DoubleSide, // Make it visible from both sides
    });
    const groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      groundMaterial
    );
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // --- Cannon.js physics ---
    // const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, 0, 0) }); // No gravity

    const groundBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Plane(),
    });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(groundBody);

    // --- Box shape ---
    // const boxShape = new CANNON.Box(new CANNON.Vec3(1, 1, 1));
    // const boxBody = new CANNON.Body({
    //   mass: 1,
    //   shape: boxShape,
    //   position: new CANNON.Vec3(0, 5, 0),
    // });
    // boxBody.angularFactor.set(0, 0, 0);
    // boxBody.linearDamping = 0.1;

    // world.addBody(boxBody);

    // const boxMesh = new THREE.Mesh(
    //   new THREE.BoxGeometry(2, 2, 2),
    //   new THREE.MeshStandardMaterial({ color: 0xff0000 })
    // );
    // scene.add(boxMesh);

    // --- Load 3D Model ---
    const loader = new GLTFLoader();
    let modelMesh: THREE.Object3D | null = null;
    let modelBody: CANNON.Body | null = null;

    // Hover animation variables
    const baseHoverHeight = 1.5; // Height above ground
    const hoverAmplitude = 0.1; // How much it bobs up and down
    const hoverSpeed = 2; // Speed of the hover animation

    loader.load("/spaceship.glb", (gltf: GLTF) => {
      modelMesh = gltf.scene;
      modelMesh.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          (child as THREE.Mesh).castShadow = true;
          (child as THREE.Mesh).receiveShadow = true;
        }
      });

      // Scale and add to scene
      modelMesh.scale.set(0.5, 0.5, 0.5); // adjust if too big/small
      scene.add(modelMesh);

      // ----------------------------
      // OPTION 1: Box collider (fast)
      // ----------------------------
      const halfExtents = new CANNON.Vec3(1, 1, 1);
      const boxShape = new CANNON.Box(halfExtents);
      modelBody = new CANNON.Body({
        mass: 1,
        shape: boxShape,
        position: new CANNON.Vec3(0, baseHoverHeight, 0),
      });

      // ----------------------------
      // OPTION 2: Trimesh collider (precise but heavy)
      // ----------------------------
      // const geometry = (modelMesh.children[0] as THREE.Mesh).geometry;
      // geometry.computeBoundingBox();
      // const vertices = geometry.attributes.position.array;
      // const indices = geometry.index ? geometry.index.array : [];
      // const trimesh = new CANNON.Trimesh(
      //   Array.from(vertices) as number[],
      //   Array.from(indices) as number[]
      // );
      // modelBody = new CANNON.Body({ mass: 1 });
      // modelBody.addShape(trimesh);
      // modelBody.position.set(0, 5, 0);

      // Physics settings
      modelBody.angularFactor.set(0, 0, 0);
      modelBody.linearDamping = 0.8;
      world.addBody(modelBody);
    });

    // --- Animation ---
    const clock = new THREE.Clock();
    let totalTime = 0;

    const animate = () => {
      requestAnimationFrame(animate);
      const delta = clock.getDelta();
      totalTime += delta;

      world.step(1 / 60, delta, 3);

      // Apply force to center of mass
      // const currentInput = currentInputRef.current;
      // const forceMagnitude = 65;
      // const force = new CANNON.Vec3(
      //   currentInput.x * forceMagnitude,
      //   0,
      //   currentInput.y * forceMagnitude
      // );

      // boxBody.applyForce(force, boxBody.position);

      // boxBody.velocity.y = 0;
      // boxBody.position.y = 1;
      // boxBody.force.y = 0;

      // // Sync mesh
      // boxMesh.position.copy(boxBody.position as unknown as THREE.Vector3);
      // boxMesh.quaternion.copy(
      //   boxBody.quaternion as unknown as THREE.Quaternion
      // );

      if (modelBody && modelMesh) {
        const currentInput = currentInputRef.current;
        const isMoving = currentInput.x !== 0 || currentInput.y !== 0;

        // Calculate hover offset (only when not moving for subtle effect)
        const hoverOffset = isMoving
          ? 0
          : Math.sin(totalTime * hoverSpeed) * hoverAmplitude;
        const targetHeight = baseHoverHeight + hoverOffset;

        // Apply horizontal forces for movement
        const forceMagnitude = 25;
        const horizontalForce = new CANNON.Vec3(
          currentInput.x * forceMagnitude,
          0,
          currentInput.y * forceMagnitude
        );
        modelBody.applyForce(horizontalForce, modelBody.position);

        const dragCoefficient = 0.95; // 0.95 = light drag, 0.8 = heavy drag
        modelBody.velocity.x *= dragCoefficient;
        modelBody.velocity.z *= dragCoefficient;

        // Maintain hover height with smooth vertical correction
        const heightDifference = targetHeight - modelBody.position.y;
        const verticalForce = heightDifference * 20; // Adjust strength as needed
        modelBody.applyForce(
          new CANNON.Vec3(0, verticalForce, 0),
          modelBody.position
        );

        // Sync mesh with physics body
        modelMesh.position.copy(modelBody.position as unknown as THREE.Vector3);
        modelMesh.quaternion.copy(
          modelBody.quaternion as unknown as THREE.Quaternion
        );
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // --- Cleanup ---
    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("allInputs", handleAllInputs);

      if (
        mountRef.current &&
        renderer.domElement.parentNode === mountRef.current
      ) {
        mountRef.current.removeChild(renderer.domElement);
      }

      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      sceneInitialized.current = false;
    };
  }, []);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "10px",
          left: "10px",
          color: "white",
          backgroundColor: "rgba(0,0,0,0.5)",
          padding: "5px 10px",
          borderRadius: "5px",
          zIndex: 10,
          fontFamily: "Arial, sans-serif",
        }}
      >
        Connection Status: {connectionStatus}
      </div>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
};

export default App;

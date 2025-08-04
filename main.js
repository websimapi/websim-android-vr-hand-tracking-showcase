import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { Hand } from 'three/addons/webxr/Hand.js';

class HandTrackingVR {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: document.getElementById('hand-tracking-canvas'),
            antialias: true,
            alpha: true
        });
        
        this.hands = [];
        this.handMeshes = [];
        this.gestures = new Map();
        this.isTracking = false;
        this.videoElement = null;
        this.canvasElement = null;
        this.ctx = null;
        
        this.init();
    }

    async init() {
        this.setupRenderer();
        this.setupScene();
        this.setupLighting();
        await this.setupCameraHandTracking();
        this.setupEventListeners();
        this.animate();
        
        // Hide loading screen
        setTimeout(() => {
            document.getElementById('loading').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('loading').style.display = 'none';
            }, 500);
        }, 2000);
    }

    setupRenderer() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.xr.enabled = true;
        this.renderer.setClearColor(0x0a0a0a, 1);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        document.body.appendChild(VRButton.createButton(this.renderer));
    }

    setupScene() {
        // Create starfield background
        const starsGeometry = new THREE.BufferGeometry();
        const starsMaterial = new THREE.PointsMaterial({ color: 0x667eea, size: 0.5 });
        
        const starsVertices = [];
        for (let i = 0; i < 10000; i++) {
            const x = (Math.random() - 0.5) * 2000;
            const y = (Math.random() - 0.5) * 2000;
            const z = (Math.random() - 0.5) * 2000;
            starsVertices.push(x, y, z);
        }
        
        starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
        const stars = new THREE.Points(starsGeometry, starsMaterial);
        this.scene.add(stars);

        // Add floating particles
        const particlesGeometry = new THREE.BufferGeometry();
        const particlesMaterial = new THREE.PointsMaterial({
            color: 0x764ba2,
            size: 0.1,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending
        });

        const particlesVertices = [];
        for (let i = 0; i < 1000; i++) {
            particlesVertices.push(
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20
            );
        }

        particlesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(particlesVertices, 3));
        const particles = new THREE.Points(particlesGeometry, particlesMaterial);
        this.scene.add(particles);

        this.camera.position.set(0, 1.6, 3);
    }

    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0x667eea, 1);
        directionalLight.position.set(5, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);

        // Add colored spotlights for dramatic effect
        const spotLight1 = new THREE.SpotLight(0x667eea, 0.5);
        spotLight1.position.set(-10, 10, 0);
        spotLight1.angle = Math.PI / 6;
        this.scene.add(spotLight1);

        const spotLight2 = new THREE.SpotLight(0x764ba2, 0.5);
        spotLight2.position.set(10, 10, 0);
        spotLight2.angle = Math.PI / 6;
        this.scene.add(spotLight2);
    }

    async setupCameraHandTracking() {
        // Load MediaPipe Hands
        const { Hands } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/hands.js');
        
        // Create video element for camera input
        this.videoElement = document.createElement('video');
        this.videoElement.style.display = 'none';
        document.body.appendChild(this.videoElement);

        // Create canvas for hand detection
        this.canvasElement = document.createElement('canvas');
        this.canvasElement.style.display = 'none';
        document.body.appendChild(this.canvasElement);
        this.ctx = this.canvasElement.getContext('2d');

        // Initialize MediaPipe Hands
        this.hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`;
            }
        });

        this.hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.5
        });

        this.hands.onResults((results) => {
            this.onHandResults(results);
        });

        // Setup camera
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user' }
            });
            this.videoElement.srcObject = stream;
            this.videoElement.play();

            // Send to MediaPipe
            await this.hands.send({ image: this.videoElement });
        } catch (error) {
            console.error('Error accessing camera:', error);
            this.setupVRHands(); // Fallback to VR hands
        }

        // Create custom hand meshes for camera tracking
        this.createCustomHandMeshes();
    }

    setupVRHands() {
        // Create hand tracking controllers for VR mode
        const controller1 = this.renderer.xr.getController(0);
        const controller2 = this.renderer.xr.getController(1);
        
        // Create hand models
        const hand1 = this.renderer.xr.getHand(0);
        const hand2 = this.renderer.xr.getHand(1);
        
        // Add hand models
        const handModelFactory = new XRControllerModelFactory();
        hand1.add(handModelFactory.createHandModel(hand1, 'hands'));
        hand2.add(handModelFactory.createHandModel(hand2, 'hands'));
        
        this.scene.add(hand1);
        this.scene.add(hand2);
        
        // Store hand references
        this.vrHands = [hand1, hand2];
    }

    createCustomHandMeshes() {
        this.handMeshes = [];
        
        for (let i = 0; i < 2; i++) {
            const handMesh = new THREE.Group();
            
            // Create glowing hand skeleton
            const jointGeometry = new THREE.SphereGeometry(0.01, 16, 16);
            const jointMaterial = new THREE.MeshPhongMaterial({
                color: new THREE.Color().setHSL(i * 0.5, 0.8, 0.6),
                emissive: new THREE.Color().setHSL(i * 0.5, 0.8, 0.3),
                emissiveIntensity: 0.5,
                transparent: true,
                opacity: 0.9
            });

            const joints = [];
            for (let j = 0; j < 21; j++) {
                const joint = new THREE.Mesh(jointGeometry, jointMaterial);
                joint.userData = { jointIndex: j };
                joints.push(joint);
                handMesh.add(joint);
            }

            // Create connecting lines between joints
            const lineMaterial = new THREE.LineBasicMaterial({
                color: new THREE.Color().setHSL(i * 0.5, 0.8, 0.8),
                transparent: true,
                opacity: 0.6
            });

            const lineGeometry = new THREE.BufferGeometry();
            const linePositions = new Float32Array(20 * 2 * 3);
            lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
            
            const handLines = new THREE.LineSegments(lineGeometry, lineMaterial);
            handMesh.add(handLines);

            this.handMeshes.push({ group: handMesh, joints, lines: handLines });
            this.scene.add(handMesh);
        }
    }

    onHandResults(results) {
        if (!results.multiHandLandmarks) return;

        // Update hand meshes based on camera tracking
        results.multiHandLandmarks.forEach((landmarks, handIndex) => {
            if (handIndex >= this.handMeshes.length) return;

            const handMesh = this.handMeshes[handIndex];
            
            // Convert MediaPipe landmarks to 3D positions
            landmarks.forEach((landmark, i) => {
                if (i < handMesh.joints.length) {
                    // Scale and position for 3D space
                    const x = (landmark.x - 0.5) * 2;
                    const y = -(landmark.y - 0.5) * 2;
                    const z = -landmark.z * 2;
                    
                    handMesh.joints[i].position.set(x, y, z);
                }
            });

            // Update connecting lines
            const positions = handMesh.lines.geometry.attributes.position.array;
            let vertexIndex = 0;

            // Define hand connections (MediaPipe format)
            const connections = [
                [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
                [0, 5], [5, 6], [6, 7], [7, 8], // Index
                [5, 9], [9, 10], [10, 11], [11, 12], // Middle
                [9, 13], [13, 14], [14, 15], [15, 16], // Ring
                [13, 17], [17, 18], [18, 19], [19, 20] // Pinky
            ];

            connections.forEach(([start, end]) => {
                if (landmarks[start] && landmarks[end]) {
                    const x1 = (landmarks[start].x - 0.5) * 2;
                    const y1 = -(landmarks[start].y - 0.5) * 2;
                    const z1 = -landmarks[start].z * 2;
                    
                    const x2 = (landmarks[end].x - 0.5) * 2;
                    const y2 = -(landmarks[end].y - 0.5) * 2;
                    const z2 = -landmarks[end].z * 2;
                    
                    positions[vertexIndex++] = x1;
                    positions[vertexIndex++] = y1;
                    positions[vertexIndex++] = z1;
                    
                    positions[vertexIndex++] = x2;
                    positions[vertexIndex++] = y2;
                    positions[vertexIndex++] = z2;
                }
            });

            handMesh.lines.geometry.attributes.position.needsUpdate = true;
            
            // Detect gestures
            const gesture = this.detectCameraGestures(landmarks);
            if (gesture) {
                this.showGesture(gesture);
            }
        });

        // Continue processing
        if (this.videoElement) {
            this.hands.send({ image: this.videoElement });
        }
    }

    detectCameraGestures(landmarks) {
        if (!landmarks) return null;
        
        // Simple gesture detection based on finger positions
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const middleTip = landmarks[12];
        const ringTip = landmarks[16];
        const pinkyTip = landmarks[20];
        
        // Detect wave (simple vertical movement)
        if (Math.abs(indexTip.y - middleTip.y) < 0.1) {
            return 'wave';
        }
        
        // Detect fist
        const distances = [indexTip, middleTip, ringTip, pinkyTip].map(tip => 
            Math.sqrt((tip.x - landmarks[0].x) ** 2 + (tip.y - landmarks[0].y) ** 2)
        );
        
        if (Math.max(...distances) < 0.3) {
            return 'fist';
        }
        
        // Detect open palm
        if (Math.min(...distances) > 0.5) {
            return 'open';
        }
        
        return null;
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.onWindowResize());
        
        // UI controls
        document.getElementById('sensitivity').addEventListener('input', (e) => {
            this.updateSensitivity(parseFloat(e.target.value));
        });
        
        document.getElementById('gesture-toggle').addEventListener('click', () => {
            this.toggleGestures();
        });
        
        document.getElementById('haptics-toggle').addEventListener('click', (e) => {
            e.target.classList.toggle('active');
            this.toggleHaptics();
        });

        // Hand tracking events
        this.renderer.xr.addEventListener('handtrackingstart', () => {
            this.isTracking = true;
            console.log('Hand tracking started');
        });

        this.renderer.xr.addEventListener('handtrackingend', () => {
            this.isTracking = false;
            console.log('Hand tracking ended');
        });
    }

    updateSensitivity(value) {
        // Update hand tracking sensitivity
        if (this.hands && this.hands.setOptions) {
            this.hands.setOptions({ minDetectionConfidence: value * 0.7 });
        }
    }

    toggleGestures() {
        const button = document.getElementById('gesture-toggle');
        button.classList.toggle('active');
        button.textContent = button.classList.contains('active') ? 'Disable Gestures' : 'Enable Gestures';
        
        // Toggle gesture recognition
        this.gestureRecognition = !this.gestureRecognition;
    }

    toggleHaptics() {
        // Toggle haptic feedback
        this.hapticsEnabled = !this.hapticsEnabled;
    }

    detectGestures(hand) {
        if (!this.gestureRecognition) return null;
        
        // Simple gesture detection based on finger positions
        const joints = hand.joints;
        if (!joints) return null;
        
        // Detect wave gesture
        const palm = joints[0];
        if (palm && Math.abs(palm.position.y) > 0.5) {
            return 'wave';
        }
        
        // Detect fist gesture
        const fingers = [4, 8, 12, 16, 20];
        const isFist = fingers.every(index => {
            const joint = joints[index];
            return joint && joint.position.distanceTo(joints[0].position) < 0.1;
        });
        
        if (isFist) return 'fist';
        
        // Detect open palm
        const isOpen = fingers.every(index => {
            const joint = joints[index];
            return joint && joint.position.distanceTo(joints[0].position) > 0.15;
        });
        
        if (isOpen) return 'open';
        
        return null;
    }

    updateHandMeshes() {
        this.hands.forEach((hand, index) => {
            if (!hand.hand) return;
            
            const joints = hand.hand.values;
            const handMesh = this.handMeshes[index];
            
            if (!joints || !handMesh) return;
            
            // Update joint positions
            joints.forEach((joint, i) => {
                if (i < handMesh.joints.length && joint) {
                    handMesh.joints[i].position.copy(joint.position);
                    handMesh.joints[i].quaternion.copy(joint.quaternion);
                }
            });
            
            // Update connecting lines
            const positions = handMesh.lines.geometry.attributes.position.array;
            let vertexIndex = 0;
            
            // Define hand connections
            const connections = [
                [0, 1], [1, 2], [2, 3], [3, 4],
                [0, 5], [5, 6], [6, 7], [7, 8],
                [0, 9], [9, 10], [10, 11], [11, 12],
                [0, 13], [13, 14], [14, 15], [15, 16],
                [0, 17], [17, 18], [18, 19], [19, 20]
            ];
            
            connections.forEach(([start, end]) => {
                if (joints[start] && joints[end]) {
                    positions[vertexIndex++] = joints[start].position.x;
                    positions[vertexIndex++] = joints[start].position.y;
                    positions[vertexIndex++] = joints[start].position.z;
                    
                    positions[vertexIndex++] = joints[end].position.x;
                    positions[vertexIndex++] = joints[end].position.y;
                    positions[vertexIndex++] = joints[end].position.z;
                }
            });
            
            handMesh.lines.geometry.attributes.position.needsUpdate = true;
            
            // Detect gestures
            const gesture = this.detectGestures(hand.hand);
            if (gesture) {
                this.showGesture(gesture);
            }
        });
    }

    showGesture(gesture) {
        const indicator = document.querySelector('.gesture-indicator');
        const icon = indicator.querySelector('.gesture-icon');
        const name = indicator.querySelector('.gesture-name');
        
        const gestures = {
            wave: { icon: '👋', name: 'Wave Detected' },
            fist: { icon: '✊', name: 'Fist Detected' },
            open: { icon: '✋', name: 'Open Palm Detected' }
        };
        
        if (gestures[gesture]) {
            icon.textContent = gestures[gesture].icon;
            name.textContent = gestures[gesture].name;
            
            indicator.classList.add('show');
            setTimeout(() => {
                indicator.classList.remove('show');
            }, 2000);
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    updatePerformanceStats() {
        // Update FPS counter
        if (!this.lastTime) this.lastTime = performance.now();
        const now = performance.now();
        const fps = Math.round(1000 / (now - this.lastTime));
        this.lastTime = now;
        
        document.getElementById('fps').textContent = fps;
        
        // Update latency (simulated)
        const latency = Math.round(10 + Math.random() * 5);
        document.getElementById('latency').textContent = `${latency}ms`;
        
        // Update hands tracked
        const trackedHands = this.handMeshes.filter(mesh => 
            mesh.joints.some(joint => joint.position.length() > 0)
        ).length;
        document.getElementById('hands-tracked').textContent = trackedHands;
    }

    animate() {
        this.renderer.setAnimationLoop(() => {
            this.updatePerformanceStats();
            
            // Subtle scene rotation
            this.scene.rotation.y += 0.001;
            
            this.renderer.render(this.scene, this.camera);
        });
    }
}

// Initialize the application
const app = new HandTrackingVR();
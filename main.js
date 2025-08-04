import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

class HandTrackingVR {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: document.getElementById('hand-tracking-canvas'),
            antialias: true,
            alpha: true
        });
        
        this.cameraHands = [];
        this.vrHands = [];
        this.gestureRecognition = true;
        this.hapticsEnabled = true;
        this.isTracking = false;
        
        // Initialize immediately
        this.init();
    }

    async init() {
        this.setupRenderer();
        this.setupScene();
        this.setupLighting();
        this.setupVRHands();
        
        // Show permission prompt instead of auto-init
        document.getElementById('permission-prompt').style.display = 'block';
        
        this.setupEventListeners();
        this.animate();
        
        // Hide loading screen
        setTimeout(() => {
            document.getElementById('loading').style.opacity = '0';
        }, 1500);
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
        for (let i = 0; i < 5000; i++) {
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
        for (let i = 0; i < 500; i++) {
            particlesVertices.push(
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20
            );
        }

        particlesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(particlesVertices, 3));
        const particles = new THREE.Points(particlesGeometry, particlesMaterial);
        this.scene.add(particles);

        // Add a ground plane
        const planeGeometry = new THREE.PlaneGeometry(50, 50);
        const planeMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x1a1a1a,
            transparent: true,
            opacity: 0.3
        });
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = -1;
        plane.receiveShadow = true;
        this.scene.add(plane);

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

    setupVRHands() {
        // Create hand tracking controllers for VR mode
        const hand1 = this.renderer.xr.getHand(0);
        const hand2 = this.renderer.xr.getHand(1);
        
        // Create visual representation for VR hands using simple geometry
        for (let i = 0; i < 2; i++) {
            const hand = i === 0 ? hand1 : hand2;
            const color = new THREE.Color().setHSL(i * 0.5, 0.8, 0.6);
            
            // Create joints for hand tracking
            const jointGeometry = new THREE.SphereGeometry(0.015, 12, 12);
            const jointMaterial = new THREE.MeshPhongMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: 0.3,
                transparent: true,
                opacity: 0.8
            });

            const joints = [];
            for (let j = 0; j < 21; j++) {
                const joint = new THREE.Mesh(jointGeometry, jointMaterial);
                joints.push(joint);
                hand.add(joint);
            }

            // Create connecting lines for bones
            const lineMaterial = new THREE.LineBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.6
            });

            const lineGeometry = new THREE.BufferGeometry();
            const linePositions = new Float32Array(20 * 2 * 3); // 20 connections * 2 points * 3 coordinates
            lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
            
            const handLines = new THREE.LineSegments(lineGeometry, lineMaterial);
            hand.add(handLines);
        }
        
        this.scene.add(hand1);
        this.scene.add(hand2);
        
        // Store hand references for animation updates
        this.vrHands = [hand1, hand2];
    }

    async setupCameraHandTracking() {
        try {
            // Hide permission prompt
            document.getElementById('permission-prompt').style.display = 'none';
            
            // Request camera permission explicitly
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: 640, height: 480 }
            });
            
            // Create video element for camera input
            this.videoElement = document.createElement('video');
            this.videoElement.srcObject = stream;
            this.videoElement.playsInline = true;
            this.videoElement.style.display = 'none';
            document.body.appendChild(this.videoElement);
            await this.videoElement.play();

            // Create canvas for hand detection
            this.canvasElement = document.createElement('canvas');
            this.canvasElement.style.display = 'none';
            document.body.appendChild(this.canvasElement);
            this.ctx = this.canvasElement.getContext('2d');

            // Set canvas dimensions
            this.canvasElement.width = 640;
            this.canvasElement.height = 480;

            // Load MediaPipe Hands dynamically
            const { Hands } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/hands.js');
            
            // Initialize MediaPipe Hands
            this.cameraHands = new Hands({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`;
                }
            });

            this.cameraHands.setOptions({
                maxNumHands: 2,
                modelComplexity: 1,
                minDetectionConfidence: 0.7,
                minTrackingConfidence: 0.5
            });

            this.cameraHands.onResults((results) => {
                this.onCameraHandResults(results);
            });

            // Create camera hand meshes if not already created
            if (!this.cameraHandMeshes) {
                this.createCameraHandMeshes();
            }

            // Start processing
            const processFrame = async () => {
                if (this.videoElement && this.cameraHands && !this.videoElement.paused) {
                    await this.cameraHands.send({ image: this.videoElement });
                }
                if (this.isTrackingCamera) {
                    requestAnimationFrame(processFrame);
                }
            };
            
            this.isTrackingCamera = true;
            processFrame();
            
            // Hide loading screen fully
            document.getElementById('loading').style.display = 'none';
            
            console.log('Camera hand tracking initialized successfully');
        } catch (error) {
            console.error('Camera hand tracking failed:', error);
            document.getElementById('loading').style.display = 'none';
            document.getElementById('permission-prompt').style.display = 'block';
        }
    }

    createCameraHandMeshes() {
        this.cameraHandMeshes = [];
        
        for (let i = 0; i < 2; i++) {
            const handGroup = new THREE.Group();
            
            // Create glowing hand skeleton
            const jointGeometry = new THREE.SphereGeometry(0.02, 16, 16);
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
                joints.push(joint);
                handGroup.add(joint);
            }

            // Create connecting lines
            const lineMaterial = new THREE.LineBasicMaterial({
                color: new THREE.Color().setHSL(i * 0.5, 0.8, 0.8),
                transparent: true,
                opacity: 0.6
            });

            const lineGeometry = new THREE.BufferGeometry();
            const linePositions = new Float32Array(20 * 2 * 3);
            lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
            
            const handLines = new THREE.LineSegments(lineGeometry, lineMaterial);
            handGroup.add(handLines);

            this.cameraHandMeshes.push({ group: handGroup, joints, lines: handLines });
            this.scene.add(handGroup);
        }
    }

    onCameraHandResults(results) {
        if (!results.multiHandLandmarks || !this.cameraHandMeshes) return;

        // Show camera hand meshes and hide VR hands when camera tracking
        this.cameraHandMeshes.forEach(handMesh => {
            handMesh.group.visible = true;
        });
        
        // Hide VR hands when camera tracking is active
        this.vrHands.forEach(hand => {
            hand.visible = false;
        });

        // Show and update detected hands
        results.multiHandLandmarks.forEach((landmarks, handIndex) => {
            if (handIndex >= this.cameraHandMeshes.length) return;

            const handMesh = this.cameraHandMeshes[handIndex];
            handMesh.group.visible = true;
            
            // Convert MediaPipe landmarks to 3D positions
            landmarks.forEach((landmark, i) => {
                if (i < handMesh.joints.length) {
                    // Scale and position for 3D space in front of camera
                    const x = (landmark.x - 0.5) * 3;
                    const y = -(landmark.y - 0.5) * 3 + 0.5;
                    const z = -landmark.z * 2 - 1;
                    
                    handMesh.joints[i].position.set(x, y, z);
                }
            });

            // Update connecting lines
            const positions = handMesh.lines.geometry.attributes.position.array;
            let vertexIndex = 0;

            const connections = [
                [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
                [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15],
                [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]
            ];

            connections.forEach(([start, end]) => {
                if (landmarks[start] && landmarks[end]) {
                    const x1 = (landmarks[start].x - 0.5) * 3;
                    const y1 = -(landmarks[start].y - 0.5) * 3 + 0.5;
                    const z1 = -landmarks[start].z * 2 - 1;
                    
                    const x2 = (landmarks[end].x - 0.5) * 3;
                    const y2 = -(landmarks[end].y - 0.5) * 3 + 0.5;
                    const z2 = -landmarks[end].z * 2 - 1;
                    
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

        // Ensure at least one hand is always visible for demo
        if (!results.multiHandLandmarks.length && this.cameraHandMeshes) {
            this.cameraHandMeshes.forEach(handMesh => {
                handMesh.group.visible = false;
            });
        }
    }

    detectCameraGestures(landmarks) {
        if (!landmarks) return null;
        
        // Simple gesture detection
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const middleTip = landmarks[12];
        const ringTip = landmarks[16];
        const pinkyTip = landmarks[20];
        
        // Detect open palm
        const distances = [indexTip, middleTip, ringTip, pinkyTip].map(tip => 
            Math.sqrt((tip.x - landmarks[0].x) ** 2 + (tip.y - landmarks[0].y) ** 2)
        );
        
        if (Math.min(...distances) > 0.4) {
            return 'open';
        }
        
        // Detect fist
        if (Math.max(...distances) < 0.2) {
            return 'fist';
        }
        
        // Detect peace sign
        const indexDistance = Math.sqrt((indexTip.x - landmarks[0].x) ** 2 + (indexTip.y - landmarks[0].y) ** 2);
        const middleDistance = Math.sqrt((middleTip.x - landmarks[0].x) ** 2 + (middleTip.y - landmarks[0].y) ** 2);
        
        if (indexDistance > 0.3 && middleDistance > 0.3) {
            return 'peace';
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
        if (this.cameraHands && this.cameraHands.setOptions) {
            this.cameraHands.setOptions({ minDetectionConfidence: value * 0.7 });
        }
    }

    toggleGestures() {
        const button = document.getElementById('gesture-toggle');
        button.classList.toggle('active');
        button.textContent = button.classList.contains('active') ? 'Disable Gestures' : 'Enable Gestures';
        
        this.gestureRecognition = !this.gestureRecognition;
    }

    toggleHaptics() {
        this.hapticsEnabled = !this.hapticsEnabled;
    }

    showGesture(gesture) {
        const indicator = document.querySelector('.gesture-indicator');
        const icon = indicator.querySelector('.gesture-icon');
        const name = indicator.querySelector('.gesture-name');
        
        const gestures = {
            open: { icon: '✋', name: 'Open Palm Detected' },
            fist: { icon: '✊', name: 'Fist Detected' },
            peace: { icon: '✌️', name: 'Peace Sign Detected' },
            wave: { icon: '👋', name: 'Wave Detected' }
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
        const trackedHands = (this.cameraHandMeshes || []).filter(mesh => mesh.group.visible).length;
        document.getElementById('hands-tracked').textContent = trackedHands;
    }

    animate() {
        this.renderer.setAnimationLoop(() => {
            this.updatePerformanceStats();
            
            // Subtle scene rotation
            this.scene.rotation.y += 0.0005;
            
            this.renderer.render(this.scene, this.camera);
        });
    }
}

// Initialize the application
const app = new HandTrackingVR();
const VRM_URL = new URL('../../models/tsukuyomi/tsukuyomicom_3d_typeA_normal.vrm', import.meta.url).href;
const VRMA_FILES = [
  { file: 'VRMA_01.vrma', label: '全身を見せる' },
  { file: 'VRMA_02.vrma', label: '挨拶' },
  { file: 'VRMA_03.vrma', label: 'Vサイン' },
  { file: 'VRMA_04.vrma', label: '撃つ' },
  { file: 'VRMA_05.vrma', label: '回る' },
  { file: 'VRMA_06.vrma', label: 'モデルポーズ' },
  { file: 'VRMA_07.vrma', label: '屈伸運動' }
];

export async function mountTsukuyomiViewer(root) {
  const status = root.querySelector('[data-vrm-status]');
  const canvas = root.querySelector('[data-vrm-canvas]');
  const policy = window.HOLO_ASSET_POLICY || { publishVRM: false, publishVRMA: false };
  let renderer;
  let controls;
  let vrm;
  let mixer;
  let activeAction;
  let animationFrame = 0;
  let resizeObserver;
  let disposed = false;
  let loadingNext = false;
  let currentMotionIndex = -1;
  let THREE;
  const objectUrls = new Set();

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(animationFrame);
    if (resizeObserver) resizeObserver.disconnect();
    if (controls) controls.dispose();
    if (mixer) mixer.stopAllAction();
    if (vrm?.scene) {
      vrm.scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            for (const value of Object.values(material)) {
              if (value && value.isTexture) value.dispose();
            }
            material.dispose();
          });
        }
      });
    }
    if (renderer) {
      renderer.dispose();
      renderer.domElement.remove();
    }
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
  };

  if (!policy.publishVRM) {
    status.textContent = 'モデルの公開は、利用規約の確認と公開許諾が済むまで無効です。ローカル開発では js/asset-policy.js の設定を確認してください。';
    return cleanup;
  }

  try {
    status.textContent = '3Dライブラリを読み込み中…';
    [THREE] = await Promise.all([import('three')]);
    const [loaderModule, controlsModule, vrmModule] = await Promise.all([
      import('three/addons/loaders/GLTFLoader.js'),
      import('three/addons/controls/OrbitControls.js'),
      import('@pixiv/three-vrm')
    ]);
    if (disposed) return cleanup;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111727);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
    camera.position.set(0, 1.45, 3.5);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x111727, 1);
    scene.add(new THREE.HemisphereLight(0xdce6ff, 0x40344a, 2.0));
    const keyLight = new THREE.DirectionalLight(0xffefd7, 2.2);
    keyLight.position.set(-1.5, 3, 2);
    scene.add(keyLight);

    controls = new controlsModule.OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.9, 0);
    controls.enableDamping = true;
    controls.minDistance = 1.2;
    controls.maxDistance = 7;
    controls.update();

    const loader = new loaderModule.GLTFLoader();
    loader.register((parser) => new vrmModule.VRMLoaderPlugin(parser));

    const resize = () => {
      if (!renderer || disposed) return;
      const rect = root.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(root);
    resize();

    status.textContent = 'モデルを読み込み中…';
    const gltf = await loader.loadAsync(VRM_URL);
    if (disposed) {
      vrmModule.VRMUtils.deepDispose(gltf.scene);
      return cleanup;
    }
    vrm = gltf.userData.vrm;
    if (!vrm) throw new Error('VRM extension was not found in the model.');
    vrmModule.VRMUtils.removeUnnecessaryVertices(vrm.scene);
    vrmModule.VRMUtils.removeUnnecessaryJoints(vrm.scene);
    vrm.scene.rotation.y = Math.PI;
    vrm.scene.position.y = 0.12;
    scene.add(vrm.scene);
    status.hidden = true;

    const clock = new THREE.Clock();
    const render = () => {
      if (disposed) return;
      animationFrame = requestAnimationFrame(render);
      const delta = Math.min(clock.getDelta(), 0.1);
      if (mixer) mixer.update(delta);
      if (vrm) vrm.update(delta);
      controls.update();
      renderer.render(scene, camera);
    };
    render();

    if (policy.publishVRMA) {
      const animationModule = await import('@pixiv/three-vrm-animation');
      loader.register((parser) => new animationModule.VRMAnimationLoaderPlugin(parser));
      mixer = new THREE.AnimationMixer(vrm.scene);
      mixer.addEventListener('finished', () => {
        if (!disposed) playRandomMotion(loader, animationModule);
      });
      await playRandomMotion(loader, animationModule);
    } else {
      status.textContent = 'モデルを表示中です。VRMAモーションは公開配信許可が確認できるまで無効です。';
    }

    async function playRandomMotion(assetLoader, animationModule) {
      if (disposed || loadingNext) return;
      loadingNext = true;
      const candidates = VRMA_FILES.map((_, index) => index).filter((index) => index !== currentMotionIndex);
      const index = candidates[Math.floor(Math.random() * candidates.length)];
      const motion = VRMA_FILES[index];
      try {
        const motionUrl = new URL(`../../models/vrma/${motion.file}`, import.meta.url).href;
        const motionGltf = await assetLoader.loadAsync(motionUrl);
        if (disposed) {
          vrmModule.VRMUtils.deepDispose(motionGltf.scene);
          return;
        }
        const animation = motionGltf.userData.vrmAnimations?.[0];
        if (!animation) throw new Error(`No VRM animation in ${motion.file}`);
        const clip = animationModule.createVRMAnimationClip(animation, vrm);
        if (activeAction) {
          activeAction.stop();
          mixer.uncacheAction(activeAction.getClip(), vrm.scene);
        }
        activeAction = mixer.clipAction(clip);
        activeAction.reset();
        activeAction.setLoop(THREE.LoopOnce, 1);
        activeAction.clampWhenFinished = true;
        activeAction.play();
        currentMotionIndex = index;
        vrmModule.VRMUtils.deepDispose(motionGltf.scene);
      } catch (error) {
        console.error(`VRMA load failed (${motion.file}):`, error);
        status.hidden = false;
        status.textContent = 'アニメーションを読み込めませんでした。別の動作を試しています…';
        currentMotionIndex = index;
        window.setTimeout(() => playRandomMotion(assetLoader, animationModule), 500);
      } finally {
        loadingNext = false;
      }
    }
  } catch (error) {
    if (!disposed) {
      console.error('Tsukuyomi viewer error:', error);
        status.hidden = false;
      status.textContent = 'モデルを読み込めませんでした。公開設定・アセットの配置・ネットワークを確認してください。';
    }
  }

  return cleanup;
}

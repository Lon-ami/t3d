(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
/// This example is very inspired by the ModelRenderer example but updated
/// using the latest version of the API. This global object for the app contains
/// all the important data.
const cleanMapData = {
  id: null,
  mapFile: null,
  terrain: {
    data: [],
  },
  props: {
    enabled: false,
    loaded: false,
    data: [],
  },
};

const mapRenderer = {
  /// All renderers must have access to a LocalReader.
  /// The LocalReader is the object that allows us
  /// to read from the .dat
  localReader: null,

  /// The context is an object all the renderer outputs their data to
  context: null,

  /// THREE js objects
  scene: null,
  camera: null,
  renderer: null,
  mouse: null,
  controls: null,

  /// Data:
  mapData: Object.assign({}, cleanMapData),
};

/// Extend Original Logger
const myLogger = {
  lastMessageType: null,
  log: function () {
    const htmlOutput = $("#log");
    const str = Array.prototype.slice.call(arguments, 1).join(" ");
    if (arguments[1] === myLogger.lastMessageType) {
      $("#log p:last-of-type")[0].innerHTML = str;
    } else {
      htmlOutput.append($("<p>-------------</p>"));
      htmlOutput.append($("<p>" + str + "</p>"));
    }
    htmlOutput[0].scrollTop = htmlOutput[0].scrollHeight;
    myLogger.lastMessageType = arguments[1];
  },
};

$(document).ready(function () {
  /// Build TREE scene
  setupScene();

  /// Handle file pick
  $("#filePicker").change(function (evt) {
    const file = evt.target.files[0];

    mapRenderer.localReader = T3D.getLocalReader(file, onReaderCreated, "../static/t3dworker.js", myLogger);
  });

  /// Handle button click
  $("#loadMapBtn").click(onLoadMapClick);
});

/// Callback for when the LocalReader has finished setting up!
async function onReaderCreated() {
  $("#fileIdInput").removeAttr("disabled");
  $("#fileMapSelect").removeAttr("disabled");
  $("#loadMapBtn").removeAttr("disabled");

  const opt = document.createElement("option");
  opt.value = undefined;
  opt.innerHTML = ""; // whatever property it has
  $("#fileMapSelect").append(opt);

  const mapFileList = await mapRenderer.localReader.getMapList();
  const categoryList = mapFileList.reduce((list, map) => {
    if (!list.includes(map.category)) {
      list.push(map.category);
    }
    return list;
  }, []);
  for (const category of categoryList) {
    const opt = document.createElement("option");
    opt.disabled = true;
    opt.innerHTML = category;
    $("#fileMapSelect").append(opt);

    for (const map of mapFileList.filter((m) => m.category === category)) {
      const opt = document.createElement("option");
      opt.value = map.baseId;
      opt.innerHTML = map.name; // whatever property it has

      // then append it to the select element
      $("#fileMapSelect").append(opt);
    }
  }
}

/// The insterresting part!
function onLoadMapClick() {
  // Clean previous render states
  mapRenderer.mapData = Object.assign({}, cleanMapData);

  /// Get selected file id
  mapRenderer.mapData.id = $("#fileIdInput").val();

  /// Renderer settings (see the documentation of each Renderer for details)
  const renderers = [
    {
      renderClass: T3D.EnvironmentRenderer,
      settings: {},
    },
    {
      renderClass: T3D.TerrainRenderer,
      settings: {},
    },
    {
      renderClass: T3D.PropertiesRenderer,
      settings: {
        visible: true,
        showUnmaterialized: true,
      },
    },
  ];

  /// Setup the logger (hacky way because very verbose)
  T3D.Logger.logFunctions[T3D.Logger.TYPE_PROGRESS] = function () {
    myLogger.log(arguments[0], arguments[0], arguments[1]);
    console.log(arguments[0], arguments[1]);
  };

  /// Load for the first time the renderer and spawn the context
  T3D.renderMapContentsAsync(mapRenderer.localReader, mapRenderer.mapData.id, renderers, onRendererDone, myLogger);

  /// And store the mapfile for future use
  loadMapFile(mapRenderer.mapData.id, function (data) {
    mapRenderer.mapData.mapFile = data;
  });
}

/// Runs when the ModelRenderer is finshed
function onRendererDone(context) {
  document.addEventListener("mousemove", onMouseMove, false);
  cleanScene();

  /// Populate our context with the context returned
  mapRenderer.context = context;

  /// Take all the terrain tiles generated by the TerrainRenderer and add them to the scene
  for (const elem of T3D.getContextValue(context, T3D.TerrainRenderer, "terrainTiles")) {
    mapRenderer.scene.add(elem);
    mapRenderer.mapData.terrain.data.push(elem);
  }

  /// Skybox
  const hazeColor = T3D.getContextValue(context, T3D.EnvironmentRenderer, "hazeColor");
  if (hazeColor) {
    mapRenderer.renderer.setClearColor(new THREE.Color(hazeColor[2] / 255, hazeColor[1] / 255, hazeColor[0] / 255));
  }

  /// Add the water level to the scene
  const water = T3D.getContextValue(context, T3D.TerrainRenderer, "water");
  mapRenderer.scene.add(water);
  mapRenderer.mapData.terrain.data.push(water);

  /// Move the camera initial place depending on the map bounds
  const bounds = T3D.getContextValue(context, T3D.TerrainRenderer, "bounds");
  mapRenderer.camera.position.x = 0;
  mapRenderer.camera.position.y = bounds ? bounds.y2 : 0;
  mapRenderer.camera.position.z = 0;

  /// Add all the meshes from the prop renderer
  const propsMeshes = T3D.getContextValue(context, T3D.PropertiesRenderer, "meshes");
  for (const elem of propsMeshes) {
    mapRenderer.scene.add(elem);
    mapRenderer.mapData.props.data.push(elem);
  }
}

/// It's usually not needed to keep the mapFile independently but
/// because we're loading the colision/props/zone models manually, it is.
function loadMapFile(fileId, callback) {
  if (parseInt(fileId)) {
    mapRenderer.localReader.loadFile(fileId, function (arrayBuffer) {
      const ds = new DataStream(arrayBuffer, 0, DataStream.LITTLE_ENDIAN);
      const mapFile = new T3D.GW2File(ds, 0);
      callback(mapFile);
    });
  }
}

/// Wipes out the data
function cleanScene() {
  for (const type of ["terrain", "props"]) {
    for (const elem of mapRenderer.mapData[type].data) {
      mapRenderer.scene.remove(elem);
    }
    mapRenderer.mapData[type].data = [];
  }

  for (const type of ["props"]) {
    mapRenderer.mapData[type].loaded = false;
    mapRenderer.mapData[type].enabled = false;
  }
}

function onMouseMove(event) {
  const canvasBounds = mapRenderer.renderer.domElement.getBoundingClientRect();
  mapRenderer.mouse.x = ((event.clientX - canvasBounds.left) / (canvasBounds.right - canvasBounds.left)) * 2 - 1;
  mapRenderer.mouse.y = -((event.clientY - canvasBounds.top) / (canvasBounds.bottom - canvasBounds.top)) * 2 + 1;
}

/// Basic THREE stuff, don't mind it
function setupScene() {
  const canvasWidth = 800;
  const canvasHeight = 800;
  const canvasClearColor = 0x342920; // For happy rendering, always use Van Dyke Brown.
  const fov = 60;
  const aspect = 1;

  mapRenderer.camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 100000);
  mapRenderer.scene = new THREE.Scene();
  mapRenderer.mouse = new THREE.Vector2();

  /// This scene has one ambient light source and three directional lights
  const ambientLight = new THREE.AmbientLight(0x555555);
  mapRenderer.scene.add(ambientLight);

  const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight1.position.set(0, 0, 1);
  mapRenderer.scene.add(directionalLight1);

  const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight2.position.set(1, 0, 0);
  mapRenderer.scene.add(directionalLight2);

  const directionalLight3 = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight3.position.set(0, 1, 0);
  mapRenderer.scene.add(directionalLight3);

  /// Standard THREE renderer with AA
  mapRenderer.renderer = new THREE.WebGLRenderer({
    antialiasing: true,
    logarithmicDepthBuffer: true,
  });
  document.body.appendChild(mapRenderer.renderer.domElement);
  mapRenderer.renderer.setSize(canvasWidth, canvasHeight);
  mapRenderer.renderer.setClearColor(canvasClearColor);

  setupController();

  /// Note: constant continous rendering from page load
  render();
}

function setupController() {
  if (!mapRenderer.controls) {
    const controls = new THREE.OrbitControls(mapRenderer.camera, mapRenderer.renderer.domElement);
    controls.enableZoom = true;
    mapRenderer.controls = controls;
  }
}

function render() {
  window.requestAnimationFrame(render);
  mapRenderer.renderer.render(mapRenderer.scene, mapRenderer.camera);
}

},{}]},{},[1])

//# sourceMappingURL=index.js.map

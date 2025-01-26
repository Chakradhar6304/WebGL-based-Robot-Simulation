var canvas;
var gl;
var program;

var modelViewMatrix = mat4();
var projectionMatrix = mat4();

var modelViewMatrixLoc;
var projectionMatrixLoc;

var mvStack = [];
var numVertices = 36;

var TORSO_HEIGHT = 6.0;
var TORSO_WIDTH = 4.0;
var HEAD_HEIGHT = 1.8;
var HEAD_WIDTH = 1.8;
var UPPER_ARM_HEIGHT = 3.0;
var UPPER_ARM_WIDTH = 1.2;
var LOWER_ARM_HEIGHT = 2.5;
var LOWER_ARM_WIDTH = 0.75;
var UPPER_LEG_HEIGHT = 3.5;
var UPPER_LEG_WIDTH = 1.5;
var LOWER_LEG_HEIGHT = 2.75;
var LOWER_LEG_WIDTH = 1.1;

var EYE_HEIGHT = 0.4;
var EYE_WIDTH = 0.4;
var EYE_DEPTH = 0.1;
var EYE_SPACING = 0.6;

var vertices = [
    vec3(-0.5, -0.5, 0.5),
    vec3(-0.5, 0.5, 0.5),
    vec3(0.5, 0.5, 0.5),
    vec3(0.5, -0.5, 0.5),
    vec3(-0.5, -0.5, -0.5),
    vec3(-0.5, 0.5, -0.5),
    vec3(0.5, 0.5, -0.5),
    vec3(0.5, -0.5, -0.5)
];

var texCoords = [
    vec2(0, 0),
    vec2(0, 1),
    vec2(1, 1),
    vec2(1, 0),
    vec2(0, 0),
    vec2(0, 1),
    vec2(1, 1),
    vec2(1, 0)
];

var indices = [
    1, 0, 3,
    3, 2, 1,
    2, 3, 7,
    7, 6, 2,
    3, 0, 4,
    4, 7, 3,
    6, 5, 1,
    1, 2, 6,
    4, 5, 6,
    6, 7, 4,
    5, 4, 0,
    0, 1, 5
];

const at = vec3(0, 0, 0);
var eye;
var theta = 0.0;
var phi = 0.0;
var up = vec3(0, 1, 0);
var aspect;
var fovy = 45.0;
var flag = 0;
var radius = 25;
var texture1, texture2;
var activeTexture = 1;

var jumpFlag = false;
var spinFlag = false;
var jumpHeight = 0;
var spinAngle = 0;

window.onload = function init() {
    canvas = document.getElementById("gl-canvas");

    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) { alert("WebGL isn't available"); }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);

    aspect = canvas.width / canvas.height;
    gl.enable(gl.DEPTH_TEST);

    window.onkeydown = function (event) {
        var key = String.fromCharCode(event.keyCode);
        switch (key) {
            case "W":
                theta += 0.1;
                render();
                break;
            case "A":
                phi -= 0.1;
                render();
                break;
            case "X":  // Reassign downward movement to 'X'
                theta -= 0.1;
                render();
                break;
            case "D":
                phi += 0.1;
                render();
                break;
            case "P":
                flag = !flag;
                projectionMatrix = flag ? perspective(fovy, aspect, 0.5, 100) : ortho(-10, 10, -10, 10, -10, 10);
                gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));
                render();
                break;
            case "C":
                activeTexture = activeTexture === 1 ? 2 : 1;
                render();
                break;
            case "J":
                jumpFlag = !jumpFlag;
                if (jumpFlag) requestAnimationFrame(jumpAnimation);
                break;
            case "S":  // Use 'S' for spin command
                spinFlag = !spinFlag;
                if (spinFlag) requestAnimationFrame(spinAnimation);
                break;
        }
    }

    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    var vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW);

    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    var tBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(texCoords), gl.STATIC_DRAW);

    var vTexCoord = gl.getAttribLocation(program, "vTexCoord");
    gl.vertexAttribPointer(vTexCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vTexCoord);

    var iBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint8Array(indices), gl.STATIC_DRAW);

    modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
    projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");

    projectionMatrix = ortho(-10, 10, -10, 10, -10, 10);
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));

    initTextures();

    render();
}

function initTextures() {
    texture1 = gl.createTexture();
    loadTexture(texture1, 'gl-robot/texture1.jpg');

    texture2 = gl.createTexture();
    loadTexture(texture2, 'gl-robot/texture2.jpg');
}

function loadTexture(texture, url) {
    gl.bindTexture(gl.TEXTURE_2D, texture);

    var image = new Image();
    image.onload = function () {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        render();
    };
    image.src = url;
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    eye = flag ? vec3(radius * Math.sin(phi), radius * Math.sin(theta), radius * Math.cos(phi))
               : vec3(Math.sin(phi), Math.sin(theta), Math.cos(phi));
    modelViewMatrix = lookAt(eye, at, up);

    if (spinFlag) {
        modelViewMatrix = mult(modelViewMatrix, rotateY(spinAngle));
    }
    if (jumpFlag) {
        modelViewMatrix = mult(modelViewMatrix, translate(0, jumpHeight, 0));
    }

    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));

    torso();
    mvStack.push(modelViewMatrix);
    modelViewMatrix = mult(modelViewMatrix, translate(0.0, TORSO_HEIGHT, 0.0));
    head();

    modelViewMatrix = mvStack.pop();
    mvStack.push(modelViewMatrix);
    modelViewMatrix = mult(modelViewMatrix, translate(TORSO_WIDTH / 2, 3 * TORSO_HEIGHT / 4 - 0.2, 0.0));
    rightUpperArm();

    modelViewMatrix = mvStack.pop();
    mvStack.push(modelViewMatrix);
    modelViewMatrix = mult(modelViewMatrix, translate(-TORSO_WIDTH / 2, 3 * TORSO_HEIGHT / 4 - 0.2, 0.0));
    leftUpperArm();

    modelViewMatrix = mvStack.pop();
    mvStack.push(modelViewMatrix);
    modelViewMatrix = mult(modelViewMatrix, translate(TORSO_WIDTH / 4, 0.0, 0.0));
    rightUpperLeg();

    modelViewMatrix = mvStack.pop();
    mvStack.push(modelViewMatrix);
    modelViewMatrix = mult(modelViewMatrix, translate(-TORSO_WIDTH / 4, 0.0, 0.0));
    leftUpperLeg();

    modelViewMatrix = mvStack.pop();
}

function jumpAnimation() {
    if (jumpFlag) {
        jumpHeight = 2 * Math.abs(Math.sin(Date.now() / 200));
        render();
        requestAnimationFrame(jumpAnimation);
    } else {
        jumpHeight = 0;
        render();
    }
}

function spinAnimation() {
    if (spinFlag) {
        spinAngle = (spinAngle + 2) % 360;  // Increment spin angle
        render();
        requestAnimationFrame(spinAnimation);
    }
}

function bindActiveTexture() {
    if (activeTexture === 1) {
        gl.bindTexture(gl.TEXTURE_2D, texture1);
    } else {
        gl.bindTexture(gl.TEXTURE_2D, texture2);
    }
}

function scale4(a, b, c) {
    var result = mat4();
    result[0][0] = a;
    result[1][1] = b;
    result[2][2] = c;
    return result;
}

function torso() {
    bindActiveTexture();
    var s = scale4(TORSO_WIDTH, TORSO_HEIGHT, TORSO_WIDTH);
    var instanceMatrix = mult(translate(0.0, 0.5 * TORSO_HEIGHT, 0.0), s);
    var t = mult(modelViewMatrix, instanceMatrix);
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(t));
    gl.drawElements(gl.TRIANGLES, numVertices, gl.UNSIGNED_BYTE, 0);
}

function head() {
    bindActiveTexture();
    var s = scale4(HEAD_WIDTH, HEAD_HEIGHT, HEAD_WIDTH);
    var instanceMatrix = mult(translate(0.0, 0.5 * HEAD_HEIGHT, 0.0), s);
    var t = mult(modelViewMatrix, instanceMatrix);
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(t));
    gl.drawElements(gl.TRIANGLES, numVertices, gl.UNSIGNED_BYTE, 0);
}

function rightUpperArm() {
    bindActiveTexture();
    var s = scale4(UPPER_ARM_WIDTH, UPPER_ARM_HEIGHT, UPPER_ARM_WIDTH);
    var instanceMatrix = mult(translate(0.5 * UPPER_ARM_WIDTH, 0.0, 0.0), s);
    var t = mult(modelViewMatrix, instanceMatrix);
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(t));
    gl.drawElements(gl.TRIANGLES, numVertices, gl.UNSIGNED_BYTE, 0);
    modelViewMatrix = mult(modelViewMatrix, translate(0.0, -0.5 * UPPER_ARM_HEIGHT, 0.0));
    rightLowerArm();
}

function leftUpperArm() {
    bindActiveTexture();
    var s = scale4(UPPER_ARM_WIDTH, UPPER_ARM_HEIGHT, UPPER_ARM_WIDTH);
    var instanceMatrix = mult(translate(-0.5 * UPPER_ARM_WIDTH, 0.0, 0.0), s);
    var t = mult(modelViewMatrix, instanceMatrix);
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(t));
    gl.drawElements(gl.TRIANGLES, numVertices, gl.UNSIGNED_BYTE, 0);
    modelViewMatrix = mult(modelViewMatrix, translate(0.0, -0.5 * UPPER_ARM_HEIGHT, 0.0));
    leftLowerArm();
}

function rightLowerArm() {
    bindActiveTexture();
    var s = scale4(LOWER_ARM_WIDTH, LOWER_ARM_HEIGHT, LOWER_ARM_WIDTH);
    var instanceMatrix = mult(translate(0.5 * UPPER_ARM_WIDTH, -0.5 * LOWER_ARM_HEIGHT, 0.0), s);
    var t = mult(modelViewMatrix, instanceMatrix);
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(t));
    gl.drawElements(gl.TRIANGLES, numVertices, gl.UNSIGNED_BYTE, 0);
}

function leftLowerArm() {
    bindActiveTexture();
    var s = scale4(LOWER_ARM_WIDTH, LOWER_ARM_HEIGHT, LOWER_ARM_WIDTH);
    var instanceMatrix = mult(translate(-0.5 * UPPER_ARM_WIDTH, -0.5 * LOWER_ARM_HEIGHT, 0.0), s);
    var t = mult(modelViewMatrix, instanceMatrix);
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(t));
    gl.drawElements(gl.TRIANGLES, numVertices, gl.UNSIGNED_BYTE, 0);
}

function rightUpperLeg() {
    bindActiveTexture();
    var s = scale4(UPPER_LEG_WIDTH, UPPER_LEG_HEIGHT, UPPER_LEG_WIDTH);
    var instanceMatrix = mult(translate(0.0, -0.5 * UPPER_LEG_HEIGHT, 0.0), s);
    var t = mult(modelViewMatrix, instanceMatrix);
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(t));
    gl.drawElements(gl.TRIANGLES, numVertices, gl.UNSIGNED_BYTE, 0);
    modelViewMatrix = mult(modelViewMatrix, translate(0.0, -UPPER_LEG_HEIGHT, 0.0));
    rightLowerLeg();
}

function leftUpperLeg() {
    bindActiveTexture();
    var s = scale4(UPPER_LEG_WIDTH, UPPER_LEG_HEIGHT, UPPER_LEG_WIDTH);
    var instanceMatrix = mult(translate(0.0, -0.5 * UPPER_LEG_HEIGHT, 0.0), s);
    var t = mult(modelViewMatrix, instanceMatrix);
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(t));
    gl.drawElements(gl.TRIANGLES, numVertices, gl.UNSIGNED_BYTE, 0);
    modelViewMatrix = mult(modelViewMatrix, translate(0.0, -UPPER_LEG_HEIGHT, 0.0));
    leftLowerLeg();
}

function rightLowerLeg() {
    bindActiveTexture();
    var s = scale4(LOWER_LEG_WIDTH, LOWER_LEG_HEIGHT, LOWER_LEG_WIDTH);
    var instanceMatrix = mult(translate(0.0, -0.5 * LOWER_LEG_HEIGHT, 0.0), s);
    var t = mult(modelViewMatrix, instanceMatrix);
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(t));
    gl.drawElements(gl.TRIANGLES, numVertices, gl.UNSIGNED_BYTE, 0);
}

function leftLowerLeg() {
    bindActiveTexture();
    var s = scale4(LOWER_LEG_WIDTH, LOWER_LEG_HEIGHT, LOWER_LEG_WIDTH);
    var instanceMatrix = mult(translate(0.0, -0.5 * LOWER_LEG_HEIGHT, 0.0), s);
    var t = mult(modelViewMatrix, instanceMatrix);
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(t));
    gl.drawElements(gl.TRIANGLES, numVertices, gl.UNSIGNED_BYTE, 0);
}

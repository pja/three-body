$(document).ready(function(){

    //size of display
    var w = 600;
    var h = 600;
    var renderer = new THREE.WebGLRenderer();
    renderer.setSize(w,h);
    $("#screen").append( renderer.domElement );
    //start with center of mass focus selected
    $("#com").button('toggle');

    var scene = new THREE.Scene();
    //do I want perspective?
    var camera = new THREE.PerspectiveCamera( 60, w/h, 0.1, 30 );
    camera.position.z = 2;
    camera.lookAt(new THREE.Vector3(0,0,0));

    //Allows you to look around whilst focusing on the center of mass (0,0,0)
    //http://mrdoob.github.com/three.js/examples/js/controls/OrbitControls.js
    //Argh where is the documentation for this?
    var controls = new THREE.OrbitControls( camera );
    controls.addEventListener('change', render);

    //light at the center of mass
    var light = new THREE.PointLight( 0xffffff, 1, 10 );
    light.position.set( 0, 0, 0 );
    scene.add( light );
    var light2 = new THREE.PointLight( 0xffffff, 0.6, 10 );
    light2.position.set( 0, 0, 1 );
    scene.add( light2 );

    //solutions/starting positions available to simulate
    //[0:14]
    var solution = 3;

    //array of spheres, carries other information like
    //time-step size, trail length
    var bodies = [];
    reset(bodies, scene, solution);

    //simulation parameters
    var step = 0;

    //bind function to dropdown menu for solution selection
    $("#simulationSelection").click(function(x){ 
        solution = x.target.id;
        reset(bodies, scene, solution);
        camera.position.set(0,0,3);
    });
    var currentFocus = -1;
    //focus point function
    $("#focusRadio").click(function(x){ 
        var newFocus = x.target.value;
        if (currentFocus != newFocus){
            currentFocus = newFocus;
            reset(bodies, scene, solution);
            camera.position.set(0,0,3);
        }
    });

    function move(){
        for (var i = 0; i < bodies.speed; i++){
            rk4(bodies);
        }
        step++;
        //recenter on the focussed body
        if (currentFocus != -1){
            var adjustment = bodies[currentFocus].position.clone();
            for (var i = 0; i < bodies.length; i++){
                bodies[i].position.sub(adjustment);
            }
        }

        for (var i = 0; i < bodies.length; i++){
            //Lines seem to be fixed length,
            //but we can push and shift to get a trail.
            bodies[i].trail.geometry.vertices.shift();
            bodies[i].trail.geometry.vertices.push(bodies[i].position.clone());
            bodies[i].trail.geometry.verticesNeedUpdate = true;
        }

        if (step % 1000 == 0){
            for (var i = 0; i < bodies.length; i++){
                var v = bodies[i].velocity;
                var p = bodies[i].position;
                if (v.length() > 10 || p.length() > 10){
                    console.log(step);
                    return false 
                }
            }
            console.log(step);
        }
        return true;
    }

    function animate(){
        if (!move()){
            reset(bodies, scene, solution);
        }
        requestAnimationFrame( animate );
        controls.update();
        renderer.render( scene, camera );
    }

    function render(){
        renderer.render( scene, camera );
    }
        
    animate();
});

//https://en.wikipedia.org/wiki/Runge%E2%80%93Kutta_methods#Common_fourth-order_Runge.E2.80.93Kutta_method
//http://home.deds.nl/~infokees/useful/OrbitRungeKutta4.pdf
//Could we improve accuracy by considering all particles at once?
function rk4(bodies){
    var h = bodies.dt;
    var movements= [];
    for (var i = 0; i < bodies.length; i++){
        var r = bodies[i].position;
        var v = bodies[i].velocity;

        //running totals remove need to clone vectors
        //Equations 11 & 12
        var dr = new THREE.Vector3(0,0,0);
        var dv = new THREE.Vector3(0,0,0);

        //Equation 10 is missing a "+"
        var k1v = a(i, r, bodies);
        dv.add(k1v);

        var k1r = v.clone();
        dr.add(k1r);

        var k2v = a(i, k1r.multiplyScalar(h/2).add(r), bodies);
        dv.add(k2v).add(k2v);

        var k2r = k1v.multiplyScalar(h/2).add(v);
        dr.add(k2r).add(k2r);

        var k3v = a(i, k2r.multiplyScalar(h/2).add(r), bodies);
        dv.add(k3v).add(k3v);

        var k3r = k2v.multiplyScalar(h/2).add(v);
        dr.add(k3r).add(k3r);

        var k4v = a(i, k3r.multiplyScalar(h).add(r), bodies);
        dv.add(k4v);

        var k4r = k3v.multiplyScalar(h).add(v);
        dr.add(k4r);
        
        bodies[i].velocity.add(dv.multiplyScalar(h/6));
        bodies[i].position.add(dr.multiplyScalar(h/6));
    }
}

//calculates the acceleration of body i if it were at position p
function a(i, p, bodies){
    //F = G*m1*m2/r^2
    //G,m = 1
    //F points in the direction of the attractor
    var sum = new THREE.Vector3(0,0,0);
    for (var j = 0; j < bodies.length; j++){
        if (j == i){
            continue;
        }
        var d2 = p.distanceToSquared(bodies[j].position);
        var r = new THREE.Vector3(0,0,0);
        r.subVectors(bodies[j].position, p) //vector to attractor
        .normalize() //unit vector
        .divideScalar(d2);
        sum.add(r);
    }
    return sum;
}

//resets the bodies to the starting positions and velocities given in
//the paper http://arxiv.org/pdf/1303.0181v1.pdf
//solution in [0:14]
function reset(bodies, scene, solution){
    bodies.dt = 0.001;
    bodies.speed = 5;
    //numerical stability is governed by how close the bodies come to each other during an orbit
    //these are derived empically
    var instability = [10,20,10,1,2,10,20,20,50,20,100,10,10,2000,2000];
    bodies.dt /= instability[solution];
    bodies.speed *= instability[solution];

    //period of orbit from paper
    var ts =     [6.2356,  7.0039, 63.5345, 14.8939, 28.6703, 13.8658, 25.8406, 10.4668, 79.4759,  21.2710, 55.5018, 17.3284, 10.9626, 55.7898, 54.2076 ];
    var period = ts[solution];
    //make the trails as long as the orbit
    bodies.segments = period / bodies.dt/bodies.speed ;

    for (var i = 0; i < bodies.length; i++){
        scene.remove(bodies[i].trail);
        scene.remove(bodies[i]);
    }

    //n = 3...
    for (var i = 0; i < 3; i++){
        //size and detail of spheres
        var geometry = new THREE.SphereGeometry(0.1,16,16);
        var material = new THREE.MeshPhongMaterial( { color: 0xff << (i*8)} );
        var body = new THREE.Mesh( geometry, material );
        body.velocity = new THREE.Vector3(0,0,0);

        //trailing lines
        var lineMaterial = new THREE.LineBasicMaterial({ color: body.material.color });
        var lineGeometry = new THREE.Geometry();
        for (var j = 0; j < bodies.segments; j++){
            //lines start at the initial positions of the spheres
            lineGeometry.vertices.push(new THREE.Vector3([-1,1,0][i],0,0));
        }
        body.trail = new THREE.Line(lineGeometry, lineMaterial);
        bodies[i] = body;
    }

    for (var i = 0; i < bodies.length; i++){
        scene.add(bodies[i]);
        scene.add(bodies[i].trail);
    }

    //The paper refers to the particles as 1,2,3
    //I use 0,1,2
    var x1dots = [0.30689, 0.39295, 0.18428, 0.46444, 0.43917, 0.40592, 0.38344, 0.08330, 0.350112, 0.08058, 0.55906, 0.51394, 0.28270, 0.41682, 0.41734];
    var y1dots = [0.12551, 0.09758, 0.58719, 0.39606, 0.45297, 0.23016, 0.37736, 0.12789, 0.079340, 0.58884, 0.34919, 0.30474, 0.32721, 0.33033, 0.31310];

    var x1dot = x1dots[solution];
    var y1dot = y1dots[solution];

    bodies[0].velocity.x = x1dot;
    bodies[1].velocity.x = x1dot;
    bodies[2].velocity.x = -2*x1dot;

    bodies[0].velocity.y = y1dot;
    bodies[1].velocity.y = y1dot;
    bodies[2].velocity.y = -2*y1dot;

    bodies[0].position.x = -1;
    bodies[1].position.x = 1;
    bodies[2].position.x = 0;

    bodies[0].position.y = 0;
    bodies[1].position.y = 0;
    bodies[2].position.y = 0;
}




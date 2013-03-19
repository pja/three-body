var Simulation = function(solution, focus){
    console.log("Simulation: solution", solution, "focus", focus);
    //solutions/starting positions available to simulate [0:14]
    //focus determines which body the camera looks at, or center of mass

    //jquery selector for dom element we're going to render to
    var screen = "#screen";
    if (!Detector.webgl){
        $(screen).append(Detector.getWebGLErrorMessage());
    }

    //size of display
    var w = $(screen).width();
    var h = $(screen).height();
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(w,h);
    $(screen).append( this.renderer.domElement );

    this.scene = new THREE.Scene();
    //do I want perspective?
    this.camera = new THREE.PerspectiveCamera( 60, w/h, 0.1, 30 );
    this.camera.position.z = 3;
    this.camera.lookAt(new THREE.Vector3(0,0,0));

    //Allows you to look around whilst focusing on a point
    this.controls = new THREE.OrbitControls( this.camera , $(screen)[0]);
    this.controls.addEventListener('change', render);

    //light at the center of mass
    this.light = new THREE.PointLight( 0xffffff, 1, 10 );
    this.light.position.set( 0, 0, 0 );
    this.scene.add( this.light );
    this.light2 = new THREE.PointLight( 0xffffff, 0.6, 10 );
    this.light2.position.set( 0, 0, 1 );
    this.scene.add( this.light2 );

    var parentThis = this;
    //resets the bodies to the starting positions and velocities given in
    //the paper http://arxiv.org/pdf/1303.0181v1.pdf
    //solution in [0:14]
    this.reset = function(solution, focus){
        console.log("reset: solution", solution, "focus", focus);
        parentThis.bodies.dt = 0.001;
        parentThis.bodies.speed = 5;
        parentThis.bodies.focus = focus;
        //numerical stability is governed by how close the parentThis.bodies come to each other during an orbit
        //these are derived empically
        var instability = [10,20,10,1,2,10,20,20,50,20,100,10,10,2000,2000];
        parentThis.bodies.dt /= instability[solution];
        parentThis.bodies.speed *= instability[solution];

        //period of orbit from paper
        var ts =     [6.2356,  7.0039, 63.5345, 14.8939, 28.6703, 13.8658, 25.8406, 10.4668, 79.4759,  21.2710, 55.5018, 17.3284, 10.9626, 55.7898, 54.2076 ];
        var period = ts[solution];
        //make the trails as long as the orbit
        parentThis.bodies.segments = period / parentThis.bodies.dt/parentThis.bodies.speed ;

        for (var i = 0; i < parentThis.bodies.length; i++){
            parentThis.scene.remove(parentThis.bodies[i].trail);
            parentThis.scene.remove(parentThis.bodies[i]);
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
            for (var j = 0; j < parentThis.bodies.segments; j++){
                //lines start at the initial positions of the spheres
                lineGeometry.vertices.push(new THREE.Vector3([-1,1,0][i],0,0));
            }
            body.trail = new THREE.Line(lineGeometry, lineMaterial);
            parentThis.bodies[i] = body;
        }

        for (var i = 0; i < parentThis.bodies.length; i++){
            parentThis.scene.add(parentThis.bodies[i]);
            parentThis.scene.add(parentThis.bodies[i].trail);
        }

        //The paper refers to the particles as 1,2,3
        //I use 0,1,2
        var x1dots = [0.30689, 0.39295, 0.18428, 0.46444, 0.43917, 0.40592, 0.38344, 0.08330, 0.350112, 0.08058, 0.55906, 0.51394, 0.28270, 0.41682, 0.41734];
        var y1dots = [0.12551, 0.09758, 0.58719, 0.39606, 0.45297, 0.23016, 0.37736, 0.12789, 0.079340, 0.58884, 0.34919, 0.30474, 0.32721, 0.33033, 0.31310];

        var x1dot = x1dots[solution];
        var y1dot = y1dots[solution];

        parentThis.bodies[0].velocity.x = x1dot;
        parentThis.bodies[1].velocity.x = x1dot;
        parentThis.bodies[2].velocity.x = -2*x1dot;

        parentThis.bodies[0].velocity.y = y1dot;
        parentThis.bodies[1].velocity.y = y1dot;
        parentThis.bodies[2].velocity.y = -2*y1dot;

        parentThis.bodies[0].position.x = -1;
        parentThis.bodies[1].position.x = 1;
        parentThis.bodies[2].position.x = 0;

        parentThis.bodies[0].position.y = 0;
        parentThis.bodies[1].position.y = 0;
        parentThis.bodies[2].position.y = 0;
    }

    //array of spheres, carries other information like
    //time-step size, trail length
    this.bodies = [];
    this.reset(solution, focus);

    //simulation parameters
    this.step = 0;

    function animate(){
        move(parentThis.bodies)
        parentThis.step++
        if (parentThis.step % 100== 0){
            for (var i = 0; i < parentThis.bodies.length; i++){
                var v = parentThis.bodies[i].velocity;
                var p = parentThis.bodies[i].position;
                if (v.length() > 10 || p.length() > 10){
                    console.log(parentThis.step);
                    parentThis.reset(solution, parentThis.bodies.focus);
                }
            }
            console.log(parentThis.step);
        }
        requestAnimationFrame( animate );
        parentThis.controls.update();
        parentThis.renderer.render( parentThis.scene, parentThis.camera );
    }

    function render(){
        parentThis.renderer.render( parentThis.scene, parentThis.camera );
    }
        
    animate();
};


function move(bodies){
    for (var i = 0; i < bodies.speed; i++){
        rk4(bodies);
    }
    //recenter on the focussed body
    if (bodies.focus!= -1){
        var adjustment = bodies[bodies.focus].position.clone();
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
}

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

$(function(){
    var s = new Simulation(3, -1);
    //bind function to dropdown menu for solution selection
    $("#solution").click(function(x){ 
        var focus = $("#focus .selected").val();
        var solution = $("#"+x.target.id).parent().val();
        s.reset(solution, focus);
        $("#solution .selected").removeClass("selected");
        $("#solution"+solution).addClass("selected");
    });

    //focus point function
    $("#focus").click(function(x){ 
        var focus = x.target.value;
        var solution = $("#solution .selected").parent().val();
        s.reset(solution, focus);
        $("#focus .selected").removeClass("selected");
        $("#"+x.target.id).addClass("selected");
    });

    //start with center of mass focus selected
    $("#com").button('toggle');
    $("#com").addClass('selected');
    $("#solution3").addClass("selected");
});


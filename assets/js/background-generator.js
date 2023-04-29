// function renderBackground(canvas) {
//     const context = canvas.getContext('2d');
  
//     // Get number of triangles horizontally and vertically
//     const horCount = 15;
//     const verCount = 15; // TODO: Calculate this from a desired size, aspect ratio... something. Or just don't!
//     const varianceStrength = 0.5;
//     const zVarianceStrength = 5;
//     const relaxIterations = 5;
//     const relaxStrength = 0.1;
//     const relaxCounterStrength = 1 - relaxStrength;
  
//     const canvasWidth = canvas.width;
//     const canvasHeight = canvas.height;
  
//     // Generate vertices & peturb them
//     let vertices = [];
//     let next = [];
//     for (let i = 0; i < horCount; i++) {
//         vertices[i] = [];
//         next[i] = [];
//         for (let j = 0; j < verCount; j++) {
//             // Borders are fixed
//             if (i === 0 || j === 0 || i === horCount - 1 || j === verCount - 1) {
//                 vertices[i][j] = {
//                     x: i / (horCount - 1),
//                     y: j / (verCount - 1),
//                                 z: (Math.random() - 0.5) * zVarianceStrength
//                 };
//             }
//             // All others peturbed
//             else {
//                 vertices[i][j] = {
//                     x: (i + (Math.random() - 0.5) * varianceStrength) / (horCount - 1),
//                     y: (j + (Math.random() - 0.5) * varianceStrength) / (verCount - 1),
//                     z: (Math.random() - 0.5) * zVarianceStrength
//                 };
//             }
//             next[i][j] = vertices[i][j];
//         }
//     }
  
//     // Go through some number of iterations with the neighbours pulling them
//     for (let n = 0; n < relaxIterations; n++) {
//         for (let i = 0; i < horCount; i++) {
//             for (let j = 0; j < verCount; j++) {
//                 let v = vertices[i][j];
//                 let neighbours = [[0, -1], [1, -1], [0, 1], [0, 1], [-1, 1], [-1, 0]]
//                     .filter((delta) => i + delta[0] >= 0 && i + delta[0] < horCount && j + delta[1] >= 0 && j + delta[1] < verCount)
//                     .map((delta) => vertices[i + delta[0]][j + delta[1]]);
//                 let nPos = neighbours
//                     .reduce((acc, v) => ({ x: acc.x + v.x / neighbours.length, y: acc.y + v.y / neighbours.length, z: acc.z + v.z / neighbours.length}), { x: 0, y: 0, z: 0});
//                 next[i][j] = {
//                     x: v.x * relaxCounterStrength + nPos.x * relaxStrength,
//                     y: v.y * relaxCounterStrength + nPos.y * relaxStrength,
//                     z: v.z * relaxCounterStrength + nPos.z * relaxStrength
//                 };
//                 if (i === 0 || i === horCount - 1) {
//                     next[i][j].x = v.x;
//                 }
//                 if (j === 0 || j === verCount - 1) {
//                     next[i][j].y = v.y;
//                 }
//             }
//         }
//         let tmp = vertices;
//         vertices = next;
//         next = tmp;
//     }
  
//     // Draw!
//     //let initialPath = new Path2D();
//     //initialPath.moveTo(0, 0);
//     //initialPath.lineTo(canvasWidth, 0);
//     //initialPath.lineTo(canvasWidth, canvasHeight);
//     //initialPath.lineTo(0, canvasHeight);
//     //initialPath.lineTo(0, 0);
//     //
//     //context.fillStyle = '#8AB338';
//     //context.fill(initialPath);
//     for (let i = 0; i < horCount; i++) {
//         for (let j = 0; j < verCount; j++) {
//             let v = vertices[i][j];
//             let triangles = [[1, -1], [-1, 1]]
//                 .filter((tri) => i + tri[0] >= 0 && i + tri[0] < horCount && j + tri[1] >= 0 && j + tri[1] < verCount)
//                 .map((tri) => [v, vertices[i + tri[0]][j], vertices[i + tri[0]][j + tri[1]]]);
    
//             for (let k = 0; k < triangles.length; k++) {
//                 let tri = triangles[k];

//                 // get cross product of the two vectors to get the normal vector
//                 let a1 = tri[1].x - tri[0].x;
//                 let a2 = tri[1].y - tri[0].y;
//                 let a3 = tri[1].z - tri[0].z;
//                 let b1 = tri[2].x - tri[0].x;
//                 let b2 = tri[2].y - tri[0].y;
//                 let b3 = tri[2].z - tri[0].z;
//                 let normal = {
//                     x: a2 * b3 - b2 * a3,
//                     y: b1 * a3 - a1 * b3,
//                     z: a1 * b2 - b1 * b2,
//                 };

//                 // get dot product of the y unit vector to get the final intensity
//                 let dot = normal.y;
//                 let style = '';
//                 if (dot < 0) {
//                     style = `rgba(0,0,0,${-dot})`;
//                 }
//                 else {
//                     style = `rgba(255,255,255,${dot})`;
//                 }

//                 let path = new Path2D();
//                 path.moveTo(tri[0].x * canvasWidth, tri[0].y * canvasHeight);
//                 path.lineTo(tri[1].x * canvasWidth, tri[1].y * canvasHeight);
//                 path.lineTo(tri[2].x * canvasWidth, tri[2].y * canvasHeight);
//                 path.lineTo(tri[0].x * canvasWidth, tri[0].y * canvasHeight);
//                 context.fillStyle = style;
//                 context.fill(path);
//             }
//         }
//     }
// }

function createSVG(horizontalVertices, verticalVertices, loopY, loopX) {
    const lines = [];
    lines.push('<svg width="100" height="100" viewbox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">');
  
    // Get number of triangles horizontally and vertically
    const horCount = horizontalVertices;
    const verCount = verticalVertices;
    const varianceStrength = 0.5;
    const zVarianceStrength = 5;
    const relaxIterations = 5;
    const relaxStrength = 0.1;
    const relaxCounterStrength = 1 - relaxStrength;
  
    const canvasWidth = 100;
    const canvasHeight = 100;
  
    // Generate vertices & peturb them
    let vertices = [];
    let next = [];
    for (let i = 0; i < horCount; i++) {
        vertices[i] = [];
        next[i] = [];
        for (let j = 0; j < verCount; j++) {
            vertices[i][j] = {
                x: (i + (Math.random() - 0.5) * varianceStrength) / (horCount - 1),
                y: (j + (Math.random() - 0.5) * varianceStrength) / (verCount - 1),
                z: (Math.random() - 0.5) * zVarianceStrength
            };

            // Borders are fixed
            if (!loopX && (i === 0 || i === horCount - 1)) {
                vertices[i][j].x = i / (horCount - 1);
            }
            if (!loopY && (j === 0 || j === verCount - 1)) {
                vertices[i][j].y = j / (verCount - 1);
            }

            next[i][j] = vertices[i][j];
        }
    }
  
    // Go through some number of iterations with the neighbours pulling them
    for (let n = 0; n < relaxIterations; n++) {
        for (let i = 0; i < horCount; i++) {
            for (let j = 0; j < verCount; j++) {
                let v = vertices[i][j];
                let neighbours = [[0, -1], [1, -1], [0, 1], [0, 1], [-1, 1], [-1, 0]]
                    .map((delta) => ({ i: i + delta[0], j: j + delta[1] }));
                
                // Filter out invalid neighbours & get relative positions
                neighbours = neighbours
                    .filter((n) => loopX || (n.i >= 0 && n.i < horCount))
                    .filter((n) => loopY || (n.j >= 0 && n.j < verCount))
                    .map((n) => {
                        const clampedI = (n.i + horCount) % horCount;
                        const clampedJ = (n.j + verCount) % verCount;
                        const adjX = n.i < 0 ? -1 : n.i >= horCount ? 1 : 0;
                        const adjY = n.j < 0 ? -1 : n.j >= verCount ? 1 : 0;

                        const neighbour = vertices[clampedI][clampedJ];

                        return {
                            x: neighbour.x + adjX,
                            y: neighbour.y + adjY,
                            z: neighbour.z
                        };
                    });
                let nPos = neighbours
                    .reduce((acc, v) => ({ x: acc.x + v.x / neighbours.length, y: acc.y + v.y / neighbours.length, z: acc.z + v.z / neighbours.length}), { x: 0, y: 0, z: 0});
                next[i][j] = {
                    x: v.x * relaxCounterStrength + nPos.x * relaxStrength,
                    y: v.y * relaxCounterStrength + nPos.y * relaxStrength,
                    z: v.z * relaxCounterStrength + nPos.z * relaxStrength
                };
                if (!loopX && (i === 0 || i === horCount - 1)) {
                    next[i][j].x = v.x;
                }
                if (!loopY && (j === 0 || j === verCount - 1)) {
                    next[i][j].y = v.y;
                }
            }
        }
        let tmp = vertices;
        vertices = next;
        next = tmp;
    }
  
    // Draw!
    //let initialPath = new Path2D();
    //initialPath.moveTo(0, 0);
    //initialPath.lineTo(canvasWidth, 0);
    //initialPath.lineTo(canvasWidth, canvasHeight);
    //initialPath.lineTo(0, canvasHeight);
    //initialPath.lineTo(0, 0);
    //
    //context.fillStyle = '#8AB338';
    //context.fill(initialPath);

    // If looping, add extras from the other side
    const final = [];
    for (let i = -1; i < horCount + 1; i++) {
        if (!loopX && (i < 0 || i >= horCount)) {
            continue;
        }
        final[i] = [];
        for (let j = -1; j < verCount + 1; j++) {
            if (!loopY && (j < 0 || j >= verCount)) {
                continue;
            }

            let clampedI = (i + horCount) % horCount;
            let clampedJ = (j + verCount) % verCount;
            let adjX = i < 0 ? -1 : i >= horCount ? 1 : 0;
            let adjY = j < 0 ? -1 : j >= verCount ? 1 : 0;

            let vertex = vertices[clampedI][clampedJ];

            final[i][j] = {
                x: vertex.x + adjX,
                y: vertex.y + adjY,
                z: vertex.z
            };
        }
    }


    for (let i = -1; i < horCount + 1; i++) {
        if (!final[i]) {
            continue;
        }
        for (let j = -1; j < verCount + 1; j++) {
            if (!final[i][j]) {
                continue;
            }
            let v = final[i][j];

            let triangles = [[1, -1], [-1, 1]]
                .filter((tri) => final[i + tri[0]] && final[i + tri[0]][j + tri[1]])
                .map((tri) => [v, final[i + tri[0]][j], final[i + tri[0]][j + tri[1]]]);
    
            for (let k = 0; k < triangles.length; k++) {
                let tri = triangles[k];

                // get cross product of the two vectors to get the normal vector
                let a1 = tri[1].x - tri[0].x;
                let a2 = tri[1].y - tri[0].y;
                let a3 = tri[1].z - tri[0].z;
                let b1 = tri[2].x - tri[0].x;
                let b2 = tri[2].y - tri[0].y;
                let b3 = tri[2].z - tri[0].z;
                let normal = {
                    x: a2 * b3 - b2 * a3,
                    y: b1 * a3 - a1 * b3,
                    z: a1 * b2 - b1 * b2,
                };

                // get dot product of the y unit vector to get the final intensity
                let dot = normal.y;
                let colour = dot < 0 ? 'black' : 'white';
                let opacity = Math.abs(dot).toFixed(2);

                let p0x = (tri[0].x * canvasWidth).toFixed(0);
                let p0y = (tri[0].y * canvasHeight).toFixed(0);
                let p1x = (tri[1].x * canvasWidth).toFixed(0);
                let p1y = (tri[1].y * canvasHeight).toFixed(0);
                let p2x = (tri[2].x * canvasWidth).toFixed(0);
                let p2y = (tri[2].y * canvasHeight).toFixed(0);


                lines.push(`<polygon points="${p0x},${p0y} ${p1x},${p1y} ${p2x},${p2y}" fill="${colour}" opacity="${opacity}" />`);
            }
        }
    }

    lines.push('</svg>');
    return lines.join('');
}

createSVG(10,10,true,true);
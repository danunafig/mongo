// In MongoDB 3.4, $graphLookup was introduced. In this file, we test the error cases.
load("jstests/aggregation/extras/utils.js");  // For "assertErrorCode".

(function() {
    "use strict";

    var local = db.local;

    local.drop();
    local.insert({});

    var pipeline = {
        $graphLookup: {
            from: "foreign",
            startWith: {$const: 0},
            connectToField: "a",
            connectFromField: "b",
            as: "output",
            maxDepth: "string"
        }
    };
    assertErrorCode(local, pipeline, 40100, "maxDepth must be numeric");

    pipeline = {
        $graphLookup: {
            from: "foreign",
            startWith: {$const: 0},
            connectToField: "a",
            connectFromField: "b",
            as: "output",
            maxDepth: -1
        }
    };
    assertErrorCode(local, pipeline, 40101, "maxDepth must be nonnegative");

    pipeline = {
        $graphLookup: {
            from: "foreign",
            startWith: {$const: 0},
            connectToField: "a",
            connectFromField: "b",
            as: "output",
            maxDepth: 2.3
        }
    };
    assertErrorCode(local, pipeline, 40102, "maxDepth must be representable as a long long");

    pipeline = {
        $graphLookup: {
            from: -1,
            startWith: {$const: 0},
            connectToField: "a",
            connectFromField: "b",
            as: "output"
        }
    };
    assertErrorCode(local, pipeline, 40103, "from must be a string");

    pipeline = {
        $graphLookup: {
            from: "foreign",
            startWith: {$const: 0},
            connectToField: "a",
            connectFromField: "b",
            as: 0
        }
    };
    assertErrorCode(local, pipeline, 40103, "as must be a string");

    pipeline = {
        $graphLookup: {
            from: "foreign",
            startWith: {$const: 0},
            connectToField: "a",
            connectFromField: "b",
            as: "$output"
        }
    };
    assertErrorCode(local, pipeline, 16410, "as cannot be a fieldPath");

    pipeline = {
        $graphLookup: {
            from: "foreign",
            startWith: {$const: 0},
            connectToField: "a",
            connectFromField: 0,
            as: "output"
        }
    };
    assertErrorCode(local, pipeline, 40103, "connectFromField must be a string");

    pipeline = {
        $graphLookup: {
            from: "foreign",
            startWith: {$const: 0},
            connectToField: "a",
            connectFromField: "$b",
            as: "output"
        }
    };
    assertErrorCode(local, pipeline, 16410, "connectFromField cannot be a fieldPath");

    pipeline = {
        $graphLookup: {
            from: "foreign",
            startWith: {$const: 0},
            connectToField: 0,
            connectFromField: "b",
            as: "output"
        }
    };
    assertErrorCode(local, pipeline, 40103, "connectToField must be a string");

    pipeline = {
        $graphLookup: {
            from: "foreign",
            startWith: {$const: 0},
            connectToField: "$a",
            connectFromField: "b",
            as: "output"
        }
    };
    assertErrorCode(local, pipeline, 16410, "connectToField cannot be a fieldPath");

    pipeline = {
        $graphLookup: {
            from: "foreign",
            startWith: {$const: 0},
            connectToField: "a",
            connectFromField: "b",
            as: "output",
            depthField: 0
        }
    };
    assertErrorCode(local, pipeline, 40103, "depthField must be a string");

    pipeline = {
        $graphLookup: {
            from: "foreign",
            startWith: {$const: 0},
            connectToField: "a",
            connectFromField: "b",
            as: "output",
            depthField: "$depth"
        }
    };
    assertErrorCode(local, pipeline, 16410, "depthField cannot be a fieldPath");

    pipeline = {
        $graphLookup: {
            from: "foreign",
            startWith: {$const: 0},
            connectToField: "a",
            connectFromField: "b",
            as: "output",
            notAField: "foo"
        }
    };
    assertErrorCode(local, pipeline, 40104, "unknown argument");

    pipeline = {
        $graphLookup:
            {from: "foreign", startWith: {$const: 0}, connectFromField: "b", as: "output"}
    };
    assertErrorCode(local, pipeline, 40105, "connectToField was not specified");

    pipeline = {
        $graphLookup:
            {from: "foreign", startWith: {$const: 0}, connectToField: "a", as: "output"}
    };
    assertErrorCode(local, pipeline, 40105, "connectFromField was not specified");

    pipeline = {
        $graphLookup: {from: "foreign", connectToField: "a", connectFromField: "b", as: "output"}
    };
    assertErrorCode(local, pipeline, 40105, "startWith was not specified");

    pipeline = {
        $graphLookup:
            {from: "foreign", startWith: {$const: 0}, connectToField: "a", connectFromField: "b"}
    };
    assertErrorCode(local, pipeline, 40105, "as was not specified");

    pipeline = {
        $graphLookup:
            {startWith: {$const: 0}, connectToField: "a", connectFromField: "b", as: "output"}
    };
    assertErrorCode(local, pipeline, 40105, "from was not specified");

    // $graphLookup can only be performed on a collection that has a unique _id index.
    db.createCollection("unindexed", {autoIndexId: false});

    pipeline = {
        $graphLookup: {
            from: "unindexed",
            as: "out",
            startWith: "tmp",
            connectFromField: "x",
            connectToField: "y"
        }
    };

    assertErrorCode(local, pipeline, 40106, "foreign collection did not have a unique _id index");

    // $graphLookup can only consume at most 100MB of memory.
    var foreign = db.foreign;
    foreign.drop();

    // Here, the visited set exceeds 100MB.
    var bulk = foreign.initializeUnorderedBulkOp();

    var initial = [];
    for (var i = 0; i < 8; i++) {
        var obj = {
            _id: i
        };

        obj['longString'] = new Array(14 * 1024 * 1024).join('x');
        initial.push(i);
        bulk.insert(obj);
    }
    assert.writeOK(bulk.execute());

    pipeline = {
        $graphLookup: {
            from: "foreign",
            startWith: {$literal: initial},
            connectToField: "_id",
            connectFromField: "notimportant",
            as: "graph"
        }
    };
    assertErrorCode(local, pipeline, 40099, "maximum memory usage reached");

    // Here, the visited set should grow to approximately 90 MB, and the frontier should push memory
    // usage over 100MB.
    foreign.drop();

    var bulk = foreign.initializeUnorderedBulkOp();
    for (var i = 0; i < 14; i++) {
        var obj = {
            from: 0,
            to: 1
        };
        obj['s'] = new Array(7 * 1024 * 1024).join(' ');
        bulk.insert(obj);
    }
    assert.writeOK(bulk.execute());

    pipeline = {
        $graphLookup: {
            from: "foreign",
            startWith: {$literal: 0},
            connectToField: "from",
            connectFromField: "s",
            as: "out"
        }
    };

    assertErrorCode(local, pipeline, 40099, "maximum memory usage reached");

    // Here, we test that the cache keeps memory usage under 100MB, and does not cause an error.
    foreign.drop();

    var bulk = foreign.initializeUnorderedBulkOp();
    for (var i = 0; i < 13; i++) {
        var obj = {
            from: 0,
            to: 1
        };
        obj['s'] = new Array(7 * 1024 * 1024).join(' ');
        bulk.insert(obj);
    }
    assert.writeOK(bulk.execute());

    var res = local.aggregate(
                        {
                          $graphLookup: {
                              from: "foreign",
                              startWith: {$literal: 0},
                              connectToField: "from",
                              connectFromField: "to",
                              as: "out"
                          }
                        },
                        {$unwind: {path: "$out"}}).toArray();

    assert.eq(res.length, 13);
}());

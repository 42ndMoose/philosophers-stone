--- a/src/app.js
+++ b/src/app.js
@@
-  if (action === "maintain") {
-    return {
-      mode: "maintain",
-      canon: buildEmptyCanonState(),
-      notes: cleanStringList(canonUpdate.notes || []),
-    };
-  }
-
   const updates = payload.canonUpdates || payload.canon_updates || payload.updates || {};
   const localExtraction = payload.local_extraction || payload.localExtraction || {};
   const profileUpdates =
     payload.profile_update_signals || payload.profileUpdateSignals || {};
+
+  const inferredPrinciples = normalizeLayeredCanon(
+    payload.principlesByLayer ||
+      payload.principles_by_layer ||
+      updates.principlesByLayer ||
+      updates.principles_by_layer ||
+      layerFromFlatList([
+        ...(localExtraction.principles || []),
+        ...(profileUpdates.new_principles || []),
+        ...(profileUpdates.refined_principles || []),
+        ...(payload.principles || []),
+        ...(updates.principles || []),
+        ...(updates.addPrinciples || []),
+        ...(updates.add_principles || []),
+      ]),
+  );
+  const inferredBoundaries = normalizeLayeredCanon(
+    payload.boundariesByLayer ||
+      payload.boundaries_by_layer ||
+      updates.boundariesByLayer ||
+      updates.boundaries_by_layer ||
+      layerFromFlatList([
+        ...(localExtraction.boundaries || []),
+        ...(profileUpdates.new_boundaries || []),
+        ...(profileUpdates.refined_boundaries || []),
+        ...(payload.boundaries || []),
+        ...(updates.boundaries || []),
+        ...(updates.addBoundaries || []),
+        ...(updates.add_boundaries || []),
+      ]),
+  );
+
+  if (
+    action === "maintain" &&
+    !hasAnyLayeredItems(inferredPrinciples) &&
+    !hasAnyLayeredItems(inferredBoundaries)
+  ) {
+    return {
+      mode: "maintain",
+      canon: buildEmptyCanonState(),
+      notes: cleanStringList(canonUpdate.notes || []),
+    };
+  }
 
   return {
     mode: "merge",
     canon: {
-      principles: normalizeLayeredCanon(
-        payload.principlesByLayer ||
-          payload.principles_by_layer ||
-          updates.principlesByLayer ||
-          updates.principles_by_layer ||
-          layerFromFlatList([
-            ...(localExtraction.principles || []),
-            ...(profileUpdates.new_principles || []),
-            ...(profileUpdates.refined_principles || []),
-            ...(payload.principles || []),
-            ...(updates.principles || []),
-            ...(updates.addPrinciples || []),
-            ...(updates.add_principles || []),
-          ]),
-      ),
-      boundaries: normalizeLayeredCanon(
-        payload.boundariesByLayer ||
-          payload.boundaries_by_layer ||
-          updates.boundariesByLayer ||
-          updates.boundaries_by_layer ||
-          layerFromFlatList([
-            ...(localExtraction.boundaries || []),
-            ...(profileUpdates.new_boundaries || []),
-            ...(profileUpdates.refined_boundaries || []),
-            ...(payload.boundaries || []),
-            ...(updates.boundaries || []),
-            ...(updates.addBoundaries || []),
-            ...(updates.add_boundaries || []),
-          ]),
-      ),
+      principles: inferredPrinciples,
+      boundaries: inferredBoundaries,
     },
     notes: [],
   };
 }

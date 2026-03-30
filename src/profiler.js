--- a/src/profiler.js
+++ b/src/profiler.js
@@
 axisText(value, axisKey) {
   const numeric = Number(value) || 0;
   const threshold = Number(this.config.summaryAxisFloor ?? 0.04);
   if (Math.abs(numeric) < threshold) return null;
@@
 
   return `+${Math.abs(numeric).toFixed(2)} ${label}`;
 }
+
+  axisActivityText(diagnostics, axisKey) {
+    if (!diagnostics || typeof diagnostics !== "object") return null;
+
+    const threshold = Number(this.config.summaryAxisFloor ?? 0.04);
+    const raw = Number(diagnostics.raw) || 0;
+    if (Math.abs(raw) >= threshold) return null;
+
+    const activityTotal =
+      (Number(diagnostics.poleMagnitude) || 0) +
+      (Number(diagnostics.integrationTotal) || 0);
+    const saturation = Number(diagnostics.saturation) || 1;
+    const activityScore = activityTotal / saturation;
+
+    if (activityScore < threshold || (Number(diagnostics.sourceCount) || 0) <= 0) {
+      return null;
+    }
+
+    const labels = AXIS_LABELS[axisKey];
+    const positiveTotal = Number(diagnostics.positiveTotal) || 0;
+    const negativeTotal = Number(diagnostics.negativeTotal) || 0;
+    const integrationTotal = Number(diagnostics.integrationTotal) || 0;
+    const axisLabel = axisKey === "empathyPracticality" ? "x" : "z";
+
+    if (positiveTotal > this.config.epsilon && negativeTotal > this.config.epsilon) {
+      return `[${axisLabel} active: ${labels.positive}/${labels.negative} balance]`;
+    }
+    if (integrationTotal > this.config.epsilon) {
+      return `[${axisLabel} active: integrated ${labels.positive}/${labels.negative} tension]`;
+    }
+    if (positiveTotal > this.config.epsilon) {
+      return `[${axisLabel} active: ${labels.positive}]`;
+    }
+    if (negativeTotal > this.config.epsilon) {
+      return `[${axisLabel} active: ${labels.negative}]`;
+    }
+
+    return null;
+  }
 
-  buildAggregateProfileLine(semantics = {}) {
+  buildAggregateProfileLine(semantics = {}, diagnostics = {}) {
     const parts = [];
     const yText = this.axisText(semantics.s, "epistemicStability");
     const xText = this.axisText(semantics.a, "empathyPracticality");
     const zText = this.axisText(semantics.b, "wisdomKnowledge");
+    const xActivityText = this.axisActivityText(
+      diagnostics.empathyPracticality,
+      "empathyPracticality",
+    );
+    const zActivityText = this.axisActivityText(
+      diagnostics.wisdomKnowledge,
+      "wisdomKnowledge",
+    );
 
     if (yText) parts.push(yText);
     if (xText) parts.push(xText);
+    else if (xActivityText) parts.push(xActivityText);
     if (zText) parts.push(zText);
+    else if (zActivityText) parts.push(zActivityText);
 
     if (!parts.length) {
       return "0.00 null-state | no active worldview threshold met";
@@
-      profile: [this.buildAggregateProfileLine(semanticProfile.semantics)],
+      profile: [
+        this.buildAggregateProfileLine(
+          semanticProfile.semantics,
+          semanticProfile.diagnostics,
+        ),
+      ],
       notes: this.buildSupportingNotes(),
       data: {
         point: { ...projection.point },

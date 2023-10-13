/*
 * (c) Copyright Ascensio System SIA 2010-2023
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation. In accordance with
 * Section 7(a) of the GNU AGPL its Section 15 shall be amended to the effect
 * that Ascensio System SIA expressly excludes the warranty of non-infringement
 * of any third-party rights.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR  PURPOSE. For
 * details, see the GNU AGPL at: http://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA at 20A-6 Ernesta Birznieka-Upish
 * street, Riga, Latvia, EU, LV-1050.
 *
 * The  interactive user interfaces in modified source and object code versions
 * of the Program must display Appropriate Legal Notices, as required under
 * Section 5 of the GNU AGPL version 3.
 *
 * Pursuant to Section 7(b) of the License you must retain the original Product
 * logo when distributing the program. Pursuant to Section 7(e) we decline to
 * grant you any rights under trademark law for use of our trademarks.
 *
 * All the Product's GUI elements, including illustrations and icon sets, as
 * well as technical writing content are licensed under the terms of the
 * Creative Commons Attribution-ShareAlike 4.0 International. See the License
 * terms at http://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 */


(function geometryFromClassApi(window, document) {
	// works with visio class
	// NOT FINISHED

	var FORMULA_TYPE_MULT_DIV = 0,
		FORMULA_TYPE_PLUS_MINUS = 1,
		FORMULA_TYPE_PLUS_DIV = 2,
		FORMULA_TYPE_IF_ELSE =3,
		FORMULA_TYPE_ABS = 4,
		FORMULA_TYPE_AT2 = 5,
		FORMULA_TYPE_CAT2 = 6,
		FORMULA_TYPE_COS = 7,
		FORMULA_TYPE_MAX = 8,
		FORMULA_TYPE_MOD = 9,
		FORMULA_TYPE_PIN = 10,
		FORMULA_TYPE_SAT2 = 11,
		FORMULA_TYPE_SIN = 12,
		FORMULA_TYPE_SQRT = 13,
		FORMULA_TYPE_TAN = 14,
		FORMULA_TYPE_VALUE = 15,
		FORMULA_TYPE_MIN = 16;

	var MAP_FMLA_TO_TYPE = {};
	MAP_FMLA_TO_TYPE["*/"] = FORMULA_TYPE_MULT_DIV;
	MAP_FMLA_TO_TYPE["+-"] = FORMULA_TYPE_PLUS_MINUS;
	MAP_FMLA_TO_TYPE["+/"] = FORMULA_TYPE_PLUS_DIV;
	MAP_FMLA_TO_TYPE["?:"] = FORMULA_TYPE_IF_ELSE;
	MAP_FMLA_TO_TYPE["abs"] = FORMULA_TYPE_ABS;
	MAP_FMLA_TO_TYPE["at2"] = FORMULA_TYPE_AT2;
	MAP_FMLA_TO_TYPE["cat2"] = FORMULA_TYPE_CAT2;
	MAP_FMLA_TO_TYPE["cos"] = FORMULA_TYPE_COS;
	MAP_FMLA_TO_TYPE["max"] = FORMULA_TYPE_MAX;
	MAP_FMLA_TO_TYPE["min"] = FORMULA_TYPE_MIN;
	MAP_FMLA_TO_TYPE["mod"] = FORMULA_TYPE_MOD;
	MAP_FMLA_TO_TYPE["pin"] = FORMULA_TYPE_PIN;
	MAP_FMLA_TO_TYPE["sat2"] = FORMULA_TYPE_SAT2;
	MAP_FMLA_TO_TYPE["sin"] = FORMULA_TYPE_SIN;
	MAP_FMLA_TO_TYPE["sqrt"] = FORMULA_TYPE_SQRT;
	MAP_FMLA_TO_TYPE["tan"] = FORMULA_TYPE_TAN;
	MAP_FMLA_TO_TYPE["val"] = FORMULA_TYPE_VALUE;

	const degToC = 60000;
	const radToDeg = 180 / Math.PI;
	const radToC = radToDeg * degToC;

	function getRandomPrst() {
		let types = AscCommon.g_oAutoShapesTypes[Math.floor(Math.random()*AscCommon.g_oAutoShapesTypes.length)];
		return types[Math.floor(Math.random()*types.length)].Type;
	}

	function findObject(obj, constructorName, attributeName, attributeValue) {
		// Base case: if the object is null or undefined, or if it's not an object
		if (!obj || typeof obj !== 'object') {
			return null;
		}
		// Check if the current object has the desired attribute, value, and constructor name
		if (obj.constructor.name === constructorName && obj[attributeName] === attributeValue) {
			return obj;
		}
		// Iterate over object properties and recursively search for the attribute and constructor name
		for (const key in obj) {
			if (obj.hasOwnProperty(key)) {
				const result = findObject(obj[key], constructorName, attributeName, attributeValue);
				if (result) {
					return result;
				}
			}
		}
		// If the attribute was not found, return null
		return null;
	}

	function findObjects(obj, constructorName, attributeName, attributeValue, results) {
		if (typeof results === "undefined") {
			results = [];
		}
		// Base case: if the object is null or undefined, or if it's not an object
		if (!obj || typeof obj !== 'object') {
			return [];
		}
		// Check if the current object has the desired attribute, value, and constructor name
		if (obj.constructor.name === constructorName && obj[attributeName] === attributeValue) {
			results.push(obj);
		}
		// Iterate over object properties and recursively search for the attribute and constructor name
		for (const key in obj) {
			if (obj.hasOwnProperty(key)) {
				findObjects(obj[key], constructorName, attributeName, attributeValue, results);
			}
		}
		return results;
	}

	/**
	 *
	 * @param obj
	 * @param attributeName
	 * @param attributeValue
	 * @returns {Section_Type}
	 */
	function findSection(obj, attributeName, attributeValue) {
		return findObject(obj, "Section_Type", attributeName, attributeValue);
	}

	/**
	 *
	 * @param obj
	 * @param attributeName
	 * @param attributeValue
	 * @returns {Row_Type}
	 */
	function findRow(obj, attributeName, attributeValue) {
		return findObject(obj, "Row_Type", attributeName, attributeValue);
	}

	/**
	 *
	 * @param obj
	 * @param attributeName
	 * @param attributeValue
	 * @returns {Cell_Type}
	 */
	function findCell(obj, attributeName, attributeValue) {
		return findObject(obj, "Cell_Type", attributeName, attributeValue);
	}

	/**
	 *
	 * @param obj
	 * @param attributeName
	 * @param attributeValue
	 * @returns {Section_Type[]}
	 */
	function findSections(obj, attributeName, attributeValue) {
		return findObjects(obj, "Section_Type", attributeName, attributeValue);
	}

	/**
	 *
	 * @param obj
	 * @param attributeName
	 * @param attributeValue
	 * @returns {Row_Type[]}
	 */
	function findRows(obj, attributeName, attributeValue) {
		return findObjects(obj, "Row_Type", attributeName, attributeValue);
	}

	/**
	 *
	 * @param obj
	 * @param attributeName
	 * @param attributeValue
	 * @returns {Cell_Type[]}
	 */
	function findCells(obj, attributeName, attributeValue) {
		return findObjects(obj, "Cell_Type", attributeName, attributeValue);
	}

	/**
	 *
	 * @param {number} mm
	 * @returns {number} emus
	 */
	function mmToEmu(mm) {
		// Conversion factor: 1 cm = 360000 EMUs, 1 cm = 10 mm
		const emusPerCm = 360000;
		const mmPerCm = 10;

		// Calculate EMUs from millimeters using the new conversion factor
		const emus = mm * (emusPerCm / mmPerCm);
		return emus;
	}

	/**
	 * Calls mmToEmu on value:
	 * value * additionalUnitKoef then convert to Emus
	 * @param {number} value - mmUnits value
	 * @param {number} additionalUnitKoef
	 * @returns {number} valueCorrectUnits
	 */
	function convertUnits(value, additionalUnitKoef) {
		let valueCorrectUnits = mmToEmu(value * additionalUnitKoef);
		return valueCorrectUnits;
	}

	/**
	 * afin rotate clockwise
	 * @param {number} x
	 * @param {number} y
	 * @param {number} radiansRotateAngle radians Rotate AntiClockWise Angle. E.g. 30 degrees rotates does DOWN.
	 * @returns {{x: number, y: number}} point
	 */
	function rotatePointAroundCordsStartClockWise(x, y, radiansRotateAngle) {
		let newX = x * Math.cos(radiansRotateAngle) + y * Math.sin(radiansRotateAngle);
		let newY = x * (-1) * Math.sin(radiansRotateAngle) + y * Math.cos(radiansRotateAngle);
		return {x : newX, y: newY};
	}

	function transformEllipseParams(x, y, a, b, c, d) {
		let rx = a - x;
		let ry = d - y;

		return {wR : rx, hR : ry};
	}

	/**
	 * get Geometry object from shape object reading shape.elements
	 * @param {Shape_Type} shape
	 * @returns {Geometry} geometry
	 */
	function getGeometryFromShape(shape) {
		// init geometry
		let geometry = new AscFormat.Geometry();

		// in visio Geometry section represents Path:
		// A path is a collection of vertices and line or curve segments that specifies an enclosed area.
		// The geometry of a shape is specified by a collection of paths.
		// Each Geometry (Section_Type) element specifies a path.
		let geometrySections = findSections(shape.elements, "n", "Geometry");
		geometrySections.forEach(function (geometrySection) {
			// see [MS-VSDX]-220215 2.2.3.2.2.Geometry Path

			//	<xsd:complexType name="Geometry_Type">
			// 		<xsd:complexContent>
			// 			<xsd:extension base="Section_Type">
			// 				<xsd:choice minOccurs="0" maxOccurs="unbounded">
			// 					<xsd:element name="Cell" type="Cell_Type" minOccurs="0" maxOccurs="unbounded">
			// 						<xsd:alternative test="@N = 'NoFill'" type="NoFill_Type"/>
			// 						<xsd:alternative test="@N = 'NoLine'" type="NoLine_Type"/>
			// 						<xsd:alternative test="@N = 'NoShow'" type="NoShow_Type"/>
			// 						<xsd:alternative test="@N = 'NoSnap'" type="NoSnap_Type"/>
			// 						<xsd:alternative test="@N = 'NoQuickDrag'" type="NoQuickDrag_Type"/>
			// 						<xsd:alternative test="@N = 'Path'" type="Path_Type"/>
			// 					</xsd:element>
			// 					<xsd:element name="Row" type="GeometryRow_Type" minOccurs="0" maxOccurs="unbounded">
			// 						<xsd:alternative test="@T = 'MoveTo'" type="MoveTo_Type"/>
			// 						<xsd:alternative test="@T = 'RelMoveTo'" type="RelMoveTo_Type"/>
			// 						<xsd:alternative test="@T = 'LineTo'" type="LineTo_Type"/>
			// 						<xsd:alternative test="@T = 'RelLineTo'" type="RelLineTo_Type"/>
			// 						<xsd:alternative test="@T = 'ArcTo'" type="ArcTo_Type"/>
			// 						<xsd:alternative test="@T = 'InfiniteLine'" type="InfiniteLine_Type"/>
			// 						<xsd:alternative test="@T = 'Ellipse'" type="Ellipse_Type"/>
			// 						<xsd:alternative test="@T = 'EllipticalArcTo'" type="EllipticalArcTo_Type"/>
			// 						<xsd:alternative test="@T = 'RelEllipticalArcTo'" type="RelEllipticalArcTo_Type"/>
			// 						<xsd:alternative test="@T = 'SplineStart'" type="SplineStart_Type"/>
			// 						<xsd:alternative test="@T = 'SplineKnot'" type="SplineKnot_Type"/>
			// 						<xsd:alternative test="@T = 'PolylineTo'" type="PolylineTo_Type"/>
			// 						<xsd:alternative test="@T = 'NURBSTo'" type="NURBSTo_Type"/>
			// 						<xsd:alternative test="@T = 'RelCubBezTo'" type="RelCubBezTo_Type"/>
			// 						<xsd:alternative test="@T = 'RelQuadBezTo'" type="RelQuadBezTo_Type"/>
			// 					</xsd:element>
			// 				</xsd:choice>
			// 			</xsd:extension>
			// 		</xsd:complexContent>
			// 	</xsd:complexType>

			// The visibility of the path’s line and the visibility of the path’s fill are specified, respectively,
			// by the NoLine and NoFill Cell_Type child elements of the path’s Geometry Section_Type element.

			// While the format of the path’s line and the format of the path’s fill are specified, respectively,
			// by the line property and fill property of the shape containing the path.

			// For a path to be visible, the following conditions are necessary.
			// §	The shape containing the path is not on a layer whose Visible Cell_Type element has a value equal to zero.
			// §	The value of the NoShow Cell_Type child of the path’s Geometry Section_Type element is not equal to one.

			// NoSnap is not related to drawing.
			// NoQuickDrag is not related to drawing too. It doesn't allow us to select the shape.

			// The Path trigger is unused and MUST be ignored.

			// So Geometry section defines (for drawing): path (by rows), isShown (NoShow), NoLine, NoFill
			// So we can represent visio Geometry section using Path object
			// Use it below

			let noFillCell = findCell(geometrySection, "n", "NoFill");
			let fillValue;
			if (noFillCell) {
				fillValue = Number(noFillCell.v) ? undefined : "norm";
			} else {
				fillValue = "norm";
			}

			// imply that units were in mm until units parse realized
			// TODO parse formula and units
			// TODO parse line style fill style text style

			const additionalUnitCoefficient = g_dKoef_in_to_mm;

			let path = new AscFormat.Path();
			path.setExtrusionOk( false);
			path.setFill( fillValue);
			path.setStroke( true);
			path.setPathW(undefined);
			path.setPathH(undefined);
			/* extrusionOk, fill, stroke, w, h*/
			// path.AddPathCommand(0, undefined, fillValue, undefined, undefined, undefined);

			//TODO maybe get shapeWidth and Height from outside
			//TODO shape with RelMoveTo and RelLineTo takes wrong position

			let shapeWidth = Number(findCell(shape.elements, "n", "Width").v);
			let shapeHeight = Number(findCell(shape.elements, "n", "Height").v);

			/**
			 *
			 * @type {{x: number, y: number}}
			 */
			let lastPoint = { x: 0, y : 0};

			for (let i = 0; true; i++) {
				let rowNum = i + 1;
				let commandRow = findRow(geometrySection, "iX", rowNum);
				if (!commandRow) {
					break;
				}
				if (commandRow.del) {
					continue;
				}
				let commandName = commandRow.t;
				switch (commandName) {
					case "MoveTo":
					{
						let moveToXTextValue = Number(findCell(commandRow, "n", "X").v);
						let moveToYTextValue = Number(findCell(commandRow, "n", "Y").v);

						let newX = convertUnits(moveToXTextValue, additionalUnitCoefficient);
						let newY = convertUnits(moveToYTextValue, additionalUnitCoefficient);

						path.moveTo(newX, newY);
						lastPoint.x = newX;
						lastPoint.y = newY;
						break;
					}
					case "RelMoveTo":
					{
						let relMoveToXTextValue = Number(findCell(commandRow, "n", "X").v);
						let relMoveToYTextValue = Number(findCell(commandRow, "n", "Y").v);

						let newX = convertUnits(relMoveToXTextValue, additionalUnitCoefficient);
						let newY = convertUnits(relMoveToYTextValue, additionalUnitCoefficient);

						let relX = newX * shapeWidth;
						let relY = newY * shapeHeight;
						path.moveTo(relX, relY);
						lastPoint.x = relX;
						lastPoint.y = relY;
						break;
					}
					case "LineTo":
					{
						let lineToXTextValue = Number(findCell(commandRow, "n", "X").v);
						let lineToYTextValue = Number(findCell(commandRow, "n", "Y").v);

						let newX = convertUnits(lineToXTextValue, additionalUnitCoefficient);
						let newY = convertUnits(lineToYTextValue, additionalUnitCoefficient);

						path.lnTo(newX, newY);
						lastPoint.x = newX;
						lastPoint.y = newY;
						break;
					}
					case "RelLineTo":
					{
						let relLineToXTextValue = Number(findCell(commandRow, "n", "X").v);
						let relLineToYTextValue = Number(findCell(commandRow, "n", "Y").v);

						let newX = convertUnits(relLineToXTextValue, additionalUnitCoefficient);
						let newY = convertUnits(relLineToYTextValue, additionalUnitCoefficient);

						let newXRel = newX * shapeWidth;
						let newYRel = newY * shapeHeight;
						path.lnTo(newXRel, newYRel);
						lastPoint.x = newXRel;
						lastPoint.y = newYRel;
						break;
					}
					case "EllipticalArcTo":
					{
						// https://learn.microsoft.com/en-us/office/client-developer/visio/ellipticalarcto-row-geometry-section
						let x = Number(findCell(commandRow, "n", "X").v);
						let y = Number(findCell(commandRow, "n", "Y").v);
						let a = Number(findCell(commandRow, "n", "A").v);
						let b = Number(findCell(commandRow, "n", "B").v);
						let c = Number(findCell(commandRow, "n", "C").v);
						let d = Number(findCell(commandRow, "n", "D").v);

						let newX = convertUnits(x, additionalUnitCoefficient);
						let newY = convertUnits(y, additionalUnitCoefficient);
						let newA = convertUnits(a, additionalUnitCoefficient);
						let newB = convertUnits(b, additionalUnitCoefficient);
						let newC = c * radToC;
						let newD = d;

						// same but with a length in EMUs units and an angle in C-units, which will be expected clockwise
						// as in other sdkjs/common/Drawings/Format/Path.js functions.
						path.ellipticalArcTo(newX, newY, newA, newB, newC, newD);
						lastPoint.x = newX;
						lastPoint.y = newY;
						break;
					}
					case "Ellipse":
					{
						let centerPointXTextValue = Number(findCell(commandRow, "n", "X").v);
						let centerPointYTextValue = Number(findCell(commandRow, "n", "Y").v);
						let somePointXTextValue = Number(findCell(commandRow, "n", "A").v);
						let somePointYTextValue = Number(findCell(commandRow, "n", "B").v);
						let anotherPointXTextValue = Number(findCell(commandRow, "n", "C").v);
						let anotherPointYTextValue = Number(findCell(commandRow, "n", "D").v);

						let newX = convertUnits(centerPointXTextValue, additionalUnitCoefficient);
						let newY = convertUnits(centerPointYTextValue, additionalUnitCoefficient);
						let newA = convertUnits(somePointXTextValue, additionalUnitCoefficient);
						let newB = convertUnits(somePointYTextValue, additionalUnitCoefficient);
						let newC = convertUnits(anotherPointXTextValue, additionalUnitCoefficient);
						let newD = convertUnits(anotherPointYTextValue, additionalUnitCoefficient);

						let wRhR = transformEllipseParams(newX, newY, newA, newB, newC, newD);
						// start to draw from ellipse right point

						//TODO Check [MS-VSDX]-220215 2.2.3.2.2.Geometry Path
						path.moveTo(wRhR.wR * 2, wRhR.hR);
						path.arcTo(wRhR.wR, wRhR.hR, 0, 180 * degToC);
						path.arcTo(wRhR.wR, wRhR.hR, 180 * degToC, 180 * degToC);
						// If the Row_Type element is of type Ellipse or InfiniteLine, it specifies the only segment of the path.
						path.moveTo(lastPoint.x, lastPoint.y);
						// lastPoint.x = newX;
						// lastPoint.y = newY;
						break;
					}
					case "ArcTo":
					{
						// https://learn.microsoft.com/en-us/office/client-developer/visio/arcto-row-geometry-section
						// circular arc

						// middleGap = a can be negative which leads to opposite arc direction clockwise or anti-clockwise

						let x = Number(findCell(commandRow, "n", "X").v)					// xEnd
						let y = Number(findCell(commandRow, "n", "Y").v);					// yEnd
						let a = Number(findCell(commandRow, "n", "A").v);					// middleGap

						let newX = convertUnits(x, additionalUnitCoefficient);
						let newY = convertUnits(y, additionalUnitCoefficient);
						let newA = convertUnits(a, additionalUnitCoefficient);

						// transform params for ellipticalArcTo
						let chordVector = {x: newX - lastPoint.x, y: newY - lastPoint.y };
						let chordVectorAngle = Math.atan2(chordVector.y, chordVector.x);
						let gapVectorAngle = chordVectorAngle - Math.PI / 2; // perpendicular clock wise
						let gapVector = {x: newA * Math.cos(gapVectorAngle), y: newA * Math.sin(gapVectorAngle)};
						let chordCenter = {x: chordVector.x / 2 + lastPoint.x, y: chordVector.y / 2 + lastPoint.y};
						let controlPoint = {x: chordCenter.x + gapVector.x, y: chordCenter.y + gapVector.y};

						path.ellipticalArcTo(newX, newY, controlPoint.x, controlPoint.y, 0, 1);
						lastPoint.x = newX;
						lastPoint.y = newY;
						break;
					}
				}
			}

			// path.close();
			geometry.AddPath(path);
		});
		geometry.setPreset("Any");

		// TODO add connections
		// geometry.AddCnx('_3cd4', 'hc', 't');
		// geometry.AddCnx('cd2', 'l', 'vc');
		// geometry.AddCnx('cd4', 'hc', 'b');
		// geometry.AddCnx('0', 'r', 'vc');
		return geometry;
	}

	function getGeometryFromClass(shape) {
		// see ECMA-376-1_5th_edition and Geometry.js

		//TODO maybe get Zip so that we can find parts by relationships
		let master1shape1Geometry = getGeometryFromShape(shape)
		return master1shape1Geometry;
	}

	window['AscCommonDraw'].getGeometryFromShape = getGeometryFromShape;
	window['AscCommonDraw'].getGeometryFromClass = getGeometryFromClass;
})(window, window.document);

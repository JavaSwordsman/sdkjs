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


"use strict";
(/**
 * @param {Window} window
 * @param {undefined} undefined
 */
function (window, undefined) {


	function CExternalChartCollector(oApi) {
		this.mapChartReferences = {};
		this.api = oApi;
		this.logicDocument = this.api.getLogicDocument();
	}

	CExternalChartCollector.prototype.addChart = function (oChart) {
		if (oChart.isExternal()) {
			this.mapChartReferences[oChart.GetId()] = oChart;
		} else {
			delete this.mapChartReferences[oChart.GetId()];
		}
	};

	CExternalChartCollector.prototype.getExternalReferences = function () {
		const arrReferences = [];
		for (let sId in this.mapChartReferences) {
			const oChart = this.mapChartReferences[sId];
			if (!oChart.bDeleted) {
				const oReference = oChart.getExternalReference();
				if (oReference) {
					arrReferences.push(oReference);
				}
			}
		}
		return arrReferences;
	};

	CExternalChartCollector.prototype.updateExternalReferences = function (arrExternalReferences, fCallback) {
		const oLogicDocument = this.logicDocument;
		if (!oLogicDocument) {
			return;
		}
		const oApi = this.api;
		const mapExternalReferences = {};

		if (arrExternalReferences && arrExternalReferences.length) {
			let isLocalDesktop = window["AscDesktopEditor"] && window["AscDesktopEditor"]["IsLocalFile"]();
			const doUpdateData = function (_arrAfterPromise) {
				if (!_arrAfterPromise.length) {
					fCallback && fCallback(true);
					oApi.sendEvent("asc_onStartUpdateExternalReference", false);
					return;
				}
				oLogicDocument.StartAction(AscDFH.historydescription_Document_UpdateCharts);

				for (let i = 0; i < _arrAfterPromise.length; i++) {
					let externalReferenceId = _arrAfterPromise[i].externalReferenceId;
					let stream = _arrAfterPromise[i].stream;

					const arrExternalChartReferences = mapExternalReferences[externalReferenceId];
					if (stream && arrExternalChartReferences) {
						let wb = new AscCommonExcel.Workbook();
						wb.DrawingDocument = oLogicDocument.DrawingDocument;
						wb.theme = oLogicDocument.theme ? oLogicDocument.theme : oLogicDocument.Get_Theme();
						Asc.getBinaryOtherTableGVar(wb);
						let nEditor;
						if (!(oApi)["asc_isSupportFeature"]("ooxml") || isLocalDesktop) {
							let binaryData = stream;
							if (!isLocalDesktop) {
								binaryData = null;
								let jsZlib = new AscCommon.ZLib();
								if (!jsZlib.open(stream)) {
									oApi.sendEvent("asc_onErrorUpdateExternalReference", externalReferenceId);
									continue;
								}

								if (jsZlib.files && jsZlib.files.length) {
									binaryData = jsZlib.getFile(jsZlib.files[0]);
								}
							}

							if (binaryData) {
								nEditor = AscCommon.getEditorByBinSignature(binaryData);
								if (nEditor !== AscCommon.c_oEditorId.Spreadsheet) {
									continue;
								}

								AscFormat.ExecuteNoHistory(function () {
									const oBinaryFileReader = new AscCommonExcel.BinaryFileReader(true);
									AscCommon.pptx_content_loader.Start_UseFullUrl();
									AscCommon.pptx_content_loader.Reader.ClearConnectedObjects();
									oBinaryFileReader.Read(binaryData, wb);
									AscCommon.pptx_content_loader.Reader.AssignConnectedObjects();
								});

								for (let j = 0; j < arrExternalChartReferences.length; j += 1) {
									const oExternalReference = arrExternalChartReferences[j].externalReference;
									if (oExternalReference) {
										oExternalReference.updateData(wb, _arrAfterPromise[j].data);
										oExternalReference.chart.handleUpdateChart();
									}
								}
							}
						} else {
							nEditor = AscCommon.getEditorByOOXMLSignature(stream);
							if (nEditor !== AscCommon.c_oEditorId.Spreadsheet) {
								continue;
							}
							let updatedData = oApi.openWorkbookForExternalReferencesFromZip(wb, stream);
							wb.aWorksheets = updatedData;
							if (updatedData) {
								for (let j = 0; j < arrExternalChartReferences.length; j += 1) {
									const oExternalReference = arrExternalChartReferences[j].externalReference;
									if (oExternalReference) {
										oExternalReference.updateData(wb, _arrAfterPromise[j].data);
										oExternalReference.chart.handleUpdateChart();
									}
								}
							}
						}
					} else {
						if (arrExternalChartReferences) {
							oApi.sendEvent("asc_onErrorUpdateExternalReference", externalReferenceId);
						}
					}
				}
				fCallback && fCallback(true);
				oApi.sendEvent("asc_onStartUpdateExternalReference", false);
				oLogicDocument.FinalizeAction();
			};

			oApi.sendEvent("asc_onStartUpdateExternalReference", true);

			const arrUniqueExternalReferences = [];
			for (let i = 0; i < arrExternalReferences.length; i++) {
				const sId = arrExternalReferences[i].asc_getId();
				if (!mapExternalReferences[sId]) {
					mapExternalReferences[sId] = [];
					arrUniqueExternalReferences.push(arrExternalReferences[i]);
				}
				mapExternalReferences[sId].push(arrExternalReferences[i]);
			}

			const oDataUpdater = new AscCommon.CExternalDataLoader(arrUniqueExternalReferences, oApi, doUpdateData);
			oDataUpdater.updateExternalData();
		}
	};

	CExternalChartCollector.prototype.removeExternalReferences = function (arrReferences) {
		if (!this.logicDocument)
			return;

		this.logicDocument.StartAction(AscDFH.historydescription_Document_RemoveExternalChartReferences);
		for (let i = 0; i < arrReferences.length; i++) {
			const oChart = arrReferences[i].externalReference.chart;
			oChart.setExternalReference(null);
		}
		this.logicDocument.FinalizeAction();
		this.api.sendEvent("asc_onUpdateExternalReferenceList");
	};

	CExternalChartCollector.prototype.changeExternalReference = function (oAscExternalReference, oExternalInfo) {
		if (!this.logicDocument)
			return;

		this.logicDocument.StartAction(AscDFH.historydescription_Document_ChangeExternalChartReference);

		const chart = oAscExternalReference.externalReference.chart;
		const oNewReference = new AscCommonExcel.CChartExternalReference(chart);
		oNewReference.initFromObj(oExternalInfo);
		chart.setExternalReference(oNewReference);

		this.logicDocument.FinalizeAction();
		this.api.sendEvent("asc_onUpdateExternalReferenceList");
	};

	AscCommon.CExternalChartCollector = CExternalChartCollector;
})(window);

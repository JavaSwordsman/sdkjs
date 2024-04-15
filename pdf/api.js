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

(function(window, document)
{
	// TODO: Пока тут идет наследование от класса asc_docs_api для документов
	//       По логике нужно от этого уйти и сделать наследование от базового класса и добавить тип AscCommon.c_oEditorId.PDF
	// TODO: Возможно стоит перенести инициализацию initDocumentRenderer и тогда не придется в каждом методе проверять
	//       наличие this.DocumentRenderer
	
	/**
	 * @param config
	 * @constructor
	 * @extends {AscCommon.DocumentEditorApi}
	 */
	function PDFEditorApi(config) {
		AscCommon.DocumentEditorApi.call(this, config, AscCommon.c_oEditorId.Word);
		
		this.DocumentRenderer = null;
		this.DocumentType     = 1;
	}
	
	PDFEditorApi.prototype = Object.create(AscCommon.DocumentEditorApi.prototype);
	PDFEditorApi.prototype.constructor = PDFEditorApi;
	
	PDFEditorApi.prototype.openDocument = function(file) {
		let perfStart = performance.now();
		
		this.isOnlyReaderMode     = false;
		this.ServerIdWaitComplete = true;
		
		window["AscViewer"]["baseUrl"] = (typeof document !== 'undefined' && document.currentScript) ? "" : "./../../../../sdkjs/pdf/src/engine/";
		window["AscViewer"]["baseEngineUrl"] = "./../../../../sdkjs/pdf/src/engine/";
		
		// TODO: Возможно стоит перенести инициализацию в
		this.initDocumentRenderer();
		this.DocumentRenderer.open(file.data);
		
		AscCommon.InitBrowserInputContext(this, "id_target_cursor", "id_viewer");
		if (AscCommon.g_inputContext)
			AscCommon.g_inputContext.onResize(this.HtmlElementName);
		
		if (this.isMobileVersion)
			this.WordControl.initEventsMobile();
		
		// destroy unused memory
		let isEditForms = true;
		if (isEditForms == false) {
			AscCommon.pptx_content_writer.BinaryFileWriter = null;
			AscCommon.History.BinaryWriter = null;
		}
		
		this.WordControl.OnResize(true);

		this.FontLoader.LoadDocumentFonts([{name : AscPDF.DEFAULT_FIELD_FONT}]);

		let perfEnd = performance.now();
		AscCommon.sendClientLog("debug", AscCommon.getClientInfoString("onOpenDocument", perfEnd - perfStart), this);
	};
	PDFEditorApi.prototype.isPdfEditor = function() {
		return true;
	};
	PDFEditorApi.prototype.getLogicDocument = function() {
		return this.getPDFDoc();
	};
	PDFEditorApi.prototype.getDrawingDocument = function () {
		return this.WordControl.m_oDrawingDocument;
	};
	PDFEditorApi.prototype.getDocumentRenderer = function() {
		return this.DocumentRenderer;
	};
	PDFEditorApi.prototype.getPDFDoc = function() {
		if (!this.DocumentRenderer)
			return null;
		
		return this.DocumentRenderer.getPDFDoc();
	};
	PDFEditorApi.prototype.IsNeedDefaultFonts = function() {
		return false;
	};
	PDFEditorApi.prototype.AddTextArt = function(nStyle) {
		let oDoc = this.getPDFDoc();
		oDoc.CreateNewHistoryPoint();
		oDoc.AddTextArt(nStyle, this.getDocumentRenderer().currentPage);
		oDoc.TurnOffHistory();
	};
	PDFEditorApi.prototype["asc_setViewerThumbnailsZoom"] = function(value) {
		if (this.haveThumbnails())
			this.DocumentRenderer.Thumbnails.setZoom(value);
	};
	PDFEditorApi.prototype["asc_setViewerThumbnailsUsePageRect"] = function(value) {
		if (this.haveThumbnails())
			this.DocumentRenderer.Thumbnails.setIsDrawCurrentRect(value);
	};
	PDFEditorApi.prototype["asc_viewerThumbnailsResize"] = function() {
		if (this.haveThumbnails())
			this.WordControl.m_oDrawingDocument.m_oDocumentRenderer.Thumbnails.resize();
	};
	PDFEditorApi.prototype["asc_viewerNavigateTo"] = function(value) {
		if (!this.DocumentRenderer)
			return;
		
		this.DocumentRenderer.navigate(value);
	};
	PDFEditorApi.prototype["asc_setViewerTargetType"] = function(type) {
		if (!this.DocumentRenderer)
			return;
		
		this.DocumentRenderer.setTargetType(type);
	};
	PDFEditorApi.prototype["asc_getPageSize"] = function(pageIndex) {
		if (!this.DocumentRenderer)
			return null;
		
		let page = this.DocumentRenderer.file.pages[pageIndex];
		if (!page)
			return null;

		return {
			"W": 25.4 * page.W / page.Dpi,
			"H": 25.4 * page.H / page.Dpi
		}
	};
	PDFEditorApi.prototype.Undo           = function()
	{
		var oDoc = this.getPDFDoc();
		if (!oDoc)
			return;

		oDoc.DoUndo();
	};
	PDFEditorApi.prototype.Redo           = function()
	{
		var oDoc = this.getPDFDoc();
		if (!oDoc)
			return;

		oDoc.DoRedo();
	};
	PDFEditorApi.prototype.asc_CheckCopy = function(_clipboard /* CClipboardData */, _formats) {
		if (!this.DocumentRenderer)
			return;

		let oDoc			= this.getPDFDoc();
		let oActiveForm		= oDoc.activeForm;
		let oActiveAnnot	= oDoc.mouseDownAnnot;
		let oActiveDrawing	= oDoc.activeDrawing;

		if (oActiveForm && oActiveForm.content.IsSelectionUse()) {
			let sText = oActiveForm.content.GetSelectedText(true);
			if (!sText)
				return;

			if (AscCommon.c_oAscClipboardDataFormat.Text & _formats)
				_clipboard.pushData(AscCommon.c_oAscClipboardDataFormat.Text, sText);

			if (AscCommon.c_oAscClipboardDataFormat.Html & _formats)
				_clipboard.pushData(AscCommon.c_oAscClipboardDataFormat.Html, "<div><p><span>" + sText + "</span></p></div>");
		}
		else if (oActiveAnnot && oActiveAnnot.IsFreeText() && oActiveAnnot.IsInTextBox()) {
			let sText = oActiveAnnot.GetDocContent().GetSelectedText(true);
			if (!sText)
				return;

			if (AscCommon.c_oAscClipboardDataFormat.Text & _formats)
				_clipboard.pushData(AscCommon.c_oAscClipboardDataFormat.Text, sText);

			if (AscCommon.c_oAscClipboardDataFormat.Html & _formats)
				_clipboard.pushData(AscCommon.c_oAscClipboardDataFormat.Html, "<div><p><span>" + sText + "</span></p></div>");
		}
		else if (oActiveDrawing && oActiveDrawing.IsInTextBox()) {
			let sText = oActiveDrawing.GetDocContent().GetSelectedText(true);
			if (!sText)
				return;

			if (AscCommon.c_oAscClipboardDataFormat.Text & _formats)
				_clipboard.pushData(AscCommon.c_oAscClipboardDataFormat.Text, sText);

			if (AscCommon.c_oAscClipboardDataFormat.Html & _formats)
				_clipboard.pushData(AscCommon.c_oAscClipboardDataFormat.Html, "<div><p><span>" + sText + "</span></p></div>");
		}
		else {
			let _text_object = {Text: ""};
			let _html_data = this.DocumentRenderer.Copy(_text_object);

			if (AscCommon.c_oAscClipboardDataFormat.Text & _formats)
				_clipboard.pushData(AscCommon.c_oAscClipboardDataFormat.Text, _text_object.Text);

			if (AscCommon.c_oAscClipboardDataFormat.Html & _formats)
				_clipboard.pushData(AscCommon.c_oAscClipboardDataFormat.Html, _html_data);
		}
	};
	PDFEditorApi.prototype.asc_SelectionCut = function() {
		if (!this.DocumentRenderer)
			return;
		
		let oDoc			= this.DocumentRenderer.getPDFDoc();
		let oField			= oDoc.activeForm;
		let oActiveAnnot	= oDoc.mouseDownAnnot;
		let oActiveDrawing	= oDoc.activeDrawing;

		if (oField && oField.IsCanEditText()) {
			if (oField.content.IsSelectionUse()) {
				oField.Remove(-1);
				oDoc.UpdateCopyCutState();
			}
		}
		else if (oActiveAnnot && oActiveAnnot.IsFreeText() && oActiveAnnot.IsInTextBox()) {
			let oContent = oActiveAnnot.GetDocContent();
			if (oContent.IsSelectionUse()) {
				oActiveAnnot.Remove(-1);
				oDoc.UpdateCopyCutState();
			}
		}
		else if (oActiveDrawing && oActiveDrawing.IsInTextBox()) {
			let oContent = oActiveDrawing.GetDocContent();
			if (oContent.IsSelectionUse()) {
				oActiveDrawing.Remove(-1);
				oDoc.UpdateCopyCutState();
			}
		}
	};
	PDFEditorApi.prototype.onUpdateRestrictions = function() { };
	PDFEditorApi.prototype.asc_PasteData = function(_format, data1, data2, text_data, useCurrentPoint, callback, checkLocks) {
		if (!this.DocumentRenderer)
			return;
		
		let oDoc			= this.DocumentRenderer.getPDFDoc();
		let data			= text_data || data1;
		let oActiveForm		= oDoc.activeForm;
		let oActiveAnnot	= oDoc.mouseDownAnnot;
		let oActiveDrawing	= oDoc.activeDrawing;

		if (!data)
			return;

		if (oActiveForm && (oActiveForm.GetType() != AscPDF.FIELD_TYPES.text || oActiveForm.IsMultiline() == false))
			data = data.trim().replace(/[\n\r]/g, ' ');

		let aChars = [];
		for (let i = 0; i < data.length; i++)
			aChars.push(data[i].charCodeAt(0));

		if (oActiveForm && oActiveForm.IsCanEditText()) {
			oActiveForm.EnterText(aChars);
			oDoc.UpdateCopyCutState();
		}
		else if (oActiveAnnot && oActiveAnnot.IsFreeText() && oActiveAnnot.IsInTextBox()) {
			oActiveAnnot.EnterText(aChars);
			oDoc.UpdateCopyCutState();
		}
		else if (oActiveDrawing && oActiveDrawing.IsInTextBox()) {
			oActiveDrawing.EnterText(aChars);
			oDoc.UpdateCopyCutState();
		}
	};
	PDFEditorApi.prototype.asc_setAdvancedOptions = function(idOption, option) {
		if (this.advancedOptionsAction !== AscCommon.c_oAscAdvancedOptionsAction.Open
			|| AscCommon.EncryptionWorker.asc_setAdvancedOptions(this, idOption, option)
			|| !this.DocumentRenderer)
			return;
		
		this.DocumentRenderer.open(null, option.asc_getPassword());
	};
	PDFEditorApi.prototype.can_CopyCut = function() {
		if (!this.DocumentRenderer)
			return false;
		
		let oDoc = this.DocumentRenderer.getPDFDoc();
		if (!oDoc)
			return false;

		return oDoc.CanCopyCut().copy;
	};
	PDFEditorApi.prototype.startGetDocInfo = function() {
		let renderer = this.DocumentRenderer;
		if (!renderer)
			return;
		
		this.sync_GetDocInfoStartCallback();
		
		this.DocumentRenderer.startStatistics();
		this.DocumentRenderer.onUpdateStatistics(0, 0, 0, 0);
		
		if (this.DocumentRenderer.isFullText)
			this.sync_GetDocInfoEndCallback();
	};
	PDFEditorApi.prototype.stopGetDocInfo = function() {
		this.sync_GetDocInfoStopCallback();
		this.DocumentRenderer.endStatistics();
	};
	PDFEditorApi.prototype.asc_searchEnabled = function(isEnabled) {
		if (!this.DocumentRenderer)
			return;
		
		this.DocumentRenderer.SearchResults.IsSearch = isEnabled;
		this.WordControl.OnUpdateOverlay();
	};
	PDFEditorApi.prototype.asc_findText = function(props, isNext) {
		let oViewer 		= this.getDocumentRenderer();
		let oDoc			= this.getPDFDoc();
		let oSearchEngine	= oDoc.SearchEngine;

		if (!oViewer)
			return 0;
		
		oViewer.IsSearch = true;

		let isAsync	= (true === oViewer.findText(props, isNext));
		let result	= oSearchEngine.Count;
		
		return result;
	};
	PDFEditorApi.prototype.asc_endFindText = function() {
		if (!this.DocumentRenderer)
			return;
		
		this.DocumentRenderer.IsSearch = false;
		this.DocumentRenderer.file.onUpdateOverlay();
	};
	PDFEditorApi.prototype.asc_isSelectSearchingResults = function() {
		if (!this.DocumentRenderer)
			return false;
		
		return this.DocumentRenderer.SearchResults.Show;
	};
	PDFEditorApi.prototype.asc_StartTextAroundSearch = function() {
		if (!this.DocumentRenderer)
			return false;
		
		let oDoc = this.getPDFDoc();
		oDoc.SearchEngine.StartTextAround();
	};
	PDFEditorApi.prototype.asc_SelectSearchElement = function(id) {
		if (!this.DocumentRenderer)
			return false;
		
		this.getPDFDoc().SelectSearchElement(id);
		this.DocumentRenderer.onUpdateOverlay();
	};
	PDFEditorApi.prototype.ContentToHTML = function() {
		if (!this.DocumentRenderer)
			return "";
		
		this.DocumentReaderMode = new AscCommon.CDocumentReaderMode();
		
		this.DocumentRenderer.selectAll();
		
		var text_data = {
			data : "",
			pushData : function(format, value) { this.data = value; }
		};
		
		this.asc_CheckCopy(text_data, 2);
		
		this.DocumentRenderer.removeSelection();
		
		return text_data.data;
	};
	PDFEditorApi.prototype.goToPage = function(pageNum) {
		if (!this.DocumentRenderer)
			return;
		
		return this.DocumentRenderer.navigateToPage(pageNum);
	};
	PDFEditorApi.prototype.getCountPages = function() {
		return this.DocumentRenderer ? this.DocumentRenderer.getPagesCount() : 0;
	};
	PDFEditorApi.prototype.getCurrentPage = function() {
		return this.DocumentRenderer ? this.DocumentRenderer.currentPage : 0;
	};
	PDFEditorApi.prototype.asc_getPdfProps = function() {
		return  this.DocumentRenderer ? this.DocumentRenderer.getDocumentInfo() : null;
	};
	PDFEditorApi.prototype.asc_enterText = function(text) {
		if (!this.DocumentRenderer)
			return false;
		
		let viewer	= this.DocumentRenderer;
		let oDoc	= viewer.getPDFDoc();
		let oDrDoc	= oDoc.GetDrawingDocument();
		let oActiveForm		= oDoc.activeForm;
		let oActiveAnnot	= oDoc.mouseDownAnnot;
		let oActiveDrawing	= oDoc.activeDrawing;
		oDrDoc.UpdateTargetFromPaint = true;
		
		if (!oDoc || !viewer || (!oActiveForm && !oActiveAnnot && !oActiveDrawing))
			return false;

		let oContent;
		if (oActiveForm && oDoc.checkFieldFont(oActiveForm) && oActiveForm.IsCanEditText()) {
			oActiveForm.EnterText(text);
			oContent = oActiveForm.GetDocContent();
		}
		else if (oActiveAnnot && oActiveAnnot.IsFreeText() && oActiveAnnot.IsInTextBox()) {
			oActiveAnnot.EnterText(text);
			oContent = oActiveAnnot.GetDocContent();
		}
		else if (oActiveDrawing && oActiveDrawing.IsInTextBox()) {
			oActiveDrawing.EnterText(text);
			oContent = oActiveDrawing.GetDocContent();
		}
		
		if (oContent) {
			oDrDoc.showTarget(true);
			oDrDoc.TargetStart();

			if (oContent.IsSelectionUse() && false == oContent.IsSelectionEmpty())
				oDrDoc.TargetEnd();
		}

		return true;
	};
	PDFEditorApi.prototype.asc_createSmartArt = function (nSmartArtType, oPlaceholderObject) {
		let oViewer	= this.getDocumentRenderer();
		let oDoc	= this.getPDFDoc();

		AscCommon.g_oBinarySmartArts.checkLoadDrawing().then(function()
		{
			return AscCommon.g_oBinarySmartArts.checkLoadData(nSmartArtType);
		}).then(function()
		{
			oDoc.CreateNewHistoryPoint();
			let oSmartArt = oDoc.AddSmartArt(nSmartArtType, oPlaceholderObject, oViewer.currentPage);
			oDoc.TurnOffHistory();

			return oSmartArt;
		});
	};
	PDFEditorApi.prototype.asc_addChartDrawingObject = function(chartBinary, Placeholder) {
		let oDoc	= this.getPDFDoc();
		let oViewer	= this.getDocumentRenderer();

		oDoc.CreateNewHistoryPoint();

		AscFonts.IsCheckSymbols = true;
		oDoc.AddChartByBinary(chartBinary, true, Placeholder, oViewer.currentPage);
		AscFonts.IsCheckSymbols = false;

		oDoc.TurnOffHistory();
	};
	PDFEditorApi.prototype.asc_correctEnterText = function(oldText, newText) {
		return this.asc_enterText(newText);
	};	PDFEditorApi.prototype.asc_EditText = function() {
		let oViewer	= this.getDocumentRenderer();
		let oDoc	= this.getPDFDoc();
		
		oDoc.EditPage(oViewer.currentPage);
	};
	PDFEditorApi.prototype.asc_AddPage = function() {
		let oViewer = this.getDocumentRenderer();
		let oDoc 	= this.getPDFDoc();

		let nPos = oViewer.currentPage + 1;

		oDoc.CreateNewHistoryPoint();
		oDoc.AddPage(nPos);
		oViewer.navigateToPage(nPos);
		oDoc.TurnOffHistory();
	};
	PDFEditorApi.prototype.asc_RemovePage = function(nPage) {
		let oViewer = this.getDocumentRenderer();
		let oDoc 	= this.getPDFDoc();

		nPage = nPage != undefined ? nPage : oViewer.currentPage;

		oDoc.CreateNewHistoryPoint();
		oDoc.RemovePage(nPage);
		oViewer.navigateToPage(nPage - 1 >= 0 ? nPage - 1 : 0);
		oDoc.TurnOffHistory();
	};
	PDFEditorApi.prototype.asc_GetSelectedText = function() {
		if (!this.DocumentRenderer)
			return "";

		var textObj = {Text : ""};
		this.DocumentRenderer.Copy(textObj);
		if (textObj.Text.trim() === "")
			return "";
		
		return textObj.Text;
	};
	PDFEditorApi.prototype.asc_AddMath2 = function(Type) {
		let oDoc	= this.getPDFDoc();
		let oTextPr	= oDoc.GetDirectTextPr();

		let oMathElement = new AscCommonWord.MathMenu(Type, oTextPr ? oTextPr.Copy() : null);
		oDoc.AddToParagraph(oMathElement, false);
	};
	PDFEditorApi.prototype.sync_shapePropCallback = function(pr) {
		let oDoc		= this.getPDFDoc();
		let oController	= oDoc.GetController();

		var obj = AscFormat.CreateAscShapePropFromProp(pr);
		if (pr.fill != null && pr.fill.fill != null && pr.fill.fill.type == Asc.c_oAscFill.FILL_TYPE_BLIP) {
			this.WordControl.m_oDrawingDocument.DrawImageTextureFillShape(pr.fill.fill.RasterImageId);
		}
		
		obj.asc_setCanEditText(oController.canEditText());

		var oTextArtProperties = pr.textArtProperties;
		if (oTextArtProperties && oTextArtProperties.Fill && oTextArtProperties.Fill.fill && oTextArtProperties.Fill.fill.type == Asc.c_oAscFill.FILL_TYPE_BLIP) {
			this.WordControl.m_oDrawingDocument.DrawImageTextureFillShape(oTextArtProperties.Fill.fill.RasterImageId);
		}
		
		var _len = this.SelectedObjectsStack.length;
		if (_len > 0) {
			if (this.SelectedObjectsStack[_len - 1].Type == Asc.c_oAscTypeSelectElement.Shape) {
				this.SelectedObjectsStack[_len - 1].Value = obj;
				return;
			}
		}

		this.SelectedObjectsStack[this.SelectedObjectsStack.length] = new AscCommon.asc_CSelectedObject(Asc.c_oAscTypeSelectElement.Shape, obj);
	};
	PDFEditorApi.prototype.sync_annotPropCallback = function(annot) {
		var obj = AscPDF.CreateAscAnnotPropFromObj(annot);

		var _len = this.SelectedObjectsStack.length;
		if (_len > 0) {
			if (this.SelectedObjectsStack[_len - 1].Type == Asc.c_oAscTypeSelectElement.Annot) {
				this.SelectedObjectsStack[_len - 1].Value = obj;
				return;
			}
		}

		this.SelectedObjectsStack[this.SelectedObjectsStack.length] = new AscCommon.asc_CSelectedObject(Asc.c_oAscTypeSelectElement.Annot, obj);
	};
	PDFEditorApi.prototype.canUnGroup = function() {
		return false;
	};
	PDFEditorApi.prototype.canGroup = function() {
		return false;
	};
	PDFEditorApi.prototype.shapes_bringToFront = function() {
		this.getPDFDoc().BringToFront();
	};
	PDFEditorApi.prototype.shapes_bringForward = function() {
		this.getPDFDoc().BringForward();
	};
	PDFEditorApi.prototype.shapes_bringToBack = function() {
		this.getPDFDoc().SendToBack();
	};
	PDFEditorApi.prototype.shapes_bringBackward = function() {
		this.getPDFDoc().BringBackward();
	};

	PDFEditorApi.prototype.sync_VerticalTextAlign = function(align) {
		this.sendEvent("asc_onVerticalTextAlign", align);
	};
	PDFEditorApi.prototype.sync_Vert = function(vert) {
		this.sendEvent("asc_onVert", vert);
	};
	PDFEditorApi.prototype.asc_getHeaderFooterProperties = function() {
		return null;
	};
	PDFEditorApi.prototype.SetMarkerFormat = function(nType, value, opacity, r, g, b) {
		this.isMarkerFormat	= value;

		// from edit mode
		if (nType == undefined) {
			this.getPDFDoc().SetHighlight(r, g, b, opacity);
			return;
		}

		this.curMarkerType	= nType;
		let oDoc			= this.getPDFDoc();
		
		if (value == true)
			oDoc.BlurActiveObject();

		if (this.isMarkerFormat) {
			let aSelQuads = this.getDocumentRenderer().file.getSelectionQuads();
        	if (aSelQuads.length == 0) {
				oDoc.bOffMarkerAfterUsing = false;
			}
			else {
				oDoc.bOffMarkerAfterUsing = true;
			}

			switch (this.curMarkerType) {
				case AscPDF.ANNOTATIONS_TYPES.Highlight:
					this.SetHighlight(r, g, b, opacity);
					break;
				case AscPDF.ANNOTATIONS_TYPES.Underline:
					this.SetUnderline(r, g, b, opacity);
					break;
				case AscPDF.ANNOTATIONS_TYPES.Strikeout:
					this.SetStrikeout(r, g, b, opacity);
					break;
			}
		}
		else {
			oDoc.bOffMarkerAfterUsing = true;
		}
	};

	PDFEditorApi.prototype.get_PageWidth  = function(nPage) {
		let oDoc = this.getPDFDoc();
		return oDoc.GetPageWidthEMU();
	};
	PDFEditorApi.prototype.get_PageHeight = function(nPage) {
		let oDoc = this.getPDFDoc();
		return oDoc.GetPageHeightEMU();
	};
	/////////////////////////////////////////////////////////////
	///////// For annots
	////////////////////////////////////////////////////////////
	PDFEditorApi.prototype.StartAddShapeBasedAnnot = function(nAnnotType) {

	};
	
	/////////////////////////////////////////////////////////////
	///////// For drawings
	////////////////////////////////////////////////////////////
	PDFEditorApi.prototype.StartAddShape = function(sPreset, is_apply) {
		let oDoc	= this.getPDFDoc();
		let oDrDoc	= oDoc.GetDrawingDocument();

		if (this.isDrawTablePen) {
			this.sync_TableDrawModeCallback(false);
        }
        if (this.isDrawTableErase) {
            this.sync_TableEraseModeCallback(false);
        }

		this.stopInkDrawer();
		this.cancelEyedropper();

		oDoc.BlurActiveObject();
		this.isStartAddShape = true;
		this.addShapePreset  = sPreset;
		if (is_apply) {
			oDrDoc.LockCursorType("crosshair");
		}
		else {
			editor.sync_EndAddShape();
			editor.sync_StartAddShapeCallback(false);
		}
	};
	PDFEditorApi.prototype.ShapeApply = function(shapeProps) {
		let oDoc = this.getPDFDoc();
		oDoc.ShapeApply(shapeProps);
	};
	PDFEditorApi.prototype.ChangeShapeType = function(sShapetype) {
		let oDoc = this.getPDFDoc();

		oDoc.ChangeShapeType(sShapetype);
	};
	PDFEditorApi.prototype.ImgApply = function(obj) {
		let oDoc	= this.getPDFDoc();
		let ImagePr	= {};

		ImagePr.lockAspect = obj.lockAspect;
		ImagePr.Width      = null === obj.Width || undefined === obj.Width ? null : parseFloat(obj.Width);
		ImagePr.Height     = null === obj.Height || undefined === obj.Height ? null : parseFloat(obj.Height);

		ImagePr.title				= obj.title;
		ImagePr.bSetOriginalSize	= obj.bSetOriginalSize;
		ImagePr.description			= obj.description;
		ImagePr.name				= obj.name;
		ImagePr.rot					= obj.rot;
		ImagePr.rotAdd				= obj.rotAdd;
		ImagePr.flipH				= obj.flipH;
		ImagePr.flipV				= obj.flipV;
		ImagePr.flipHInvert			= obj.flipHInvert;
		ImagePr.flipVInvert			= obj.flipVInvert;
		ImagePr.resetCrop			= obj.resetCrop;

		if (undefined != obj.Position) {
			ImagePr.Position =
			{
				X : null === obj.Position.X || undefined === obj.Position.X ? null : parseFloat(obj.Position.X),
				Y : null === obj.Position.Y || undefined === obj.Position.Y ? null : parseFloat(obj.Position.Y)
			};
		}
		else {
			ImagePr.Position = {X : null, Y : null};
		}

		ImagePr.ImageUrl = obj.ImageUrl;

		if (window["NATIVE_EDITOR_ENJINE"]) {
		  	oDoc.SetImageProps(ImagePr);
		  	return;
		}
		if (!AscCommon.isNullOrEmptyString(ImagePr.ImageUrl)) {
			let sImageUrl = null, sToken = undefined;
			if (!g_oDocumentUrls.getImageLocal(ImagePr.ImageUrl)) {
				sImageUrl = ImagePr.ImageUrl;
				sToken = obj.Token;
			}

			let oApi           = this;
			let fApplyCallback = function() {
				let _img     = oApi.ImageLoader.LoadImage(ImagePr.ImageUrl, 1);
				let srcLocal = g_oDocumentUrls.getImageLocal(ImagePr.ImageUrl);

				if (srcLocal) {
					ImagePr.ImageUrl = srcLocal;
				}
				if (null != _img) {
					oDoc.SetImageProps(ImagePr);
				}
				else {
					oApi.asyncImageEndLoaded2 = function(_image) {
						oDoc.SetImageProps(ImagePr);
						oApi.asyncImageEndLoaded2 = null;
					}
				}
			};

			if (!sImageUrl) {
				fApplyCallback();
			}
			else {
				if (window["AscDesktopEditor"] && window["AscDesktopEditor"]["IsLocalFile"]()) {
                    this.sync_StartAction(c_oAscAsyncActionType.BlockInteraction, c_oAscAsyncAction.UploadImage);
                    let _url = window["AscDesktopEditor"]["LocalFileGetImageUrl"](sImageUrl);
                    _url     = g_oDocumentUrls.getImageUrl(_url);
                    ImagePr.ImageUrl = _url;
                    fApplyCallback();
                    this.sync_EndAction(c_oAscAsyncActionType.BlockInteraction, c_oAscAsyncAction.UploadImage);
                    return;
                }

                AscCommon.sendImgUrls(this, [sImageUrl], function(data) {

                    if (data && data[0] && data[0].url !== "error") {
                        ImagePr.ImageUrl = data[0].url;
                        fApplyCallback();
                    }

                }, undefined, sToken);
			}
		}
		else {
			ImagePr.ImageUrl = null;
			oDoc.SetImageProps(ImagePr);
		}
	};
	PDFEditorApi.prototype.asc_FitImagesToPage = function() {
		let oDoc = this.getPDFDoc();
		oDoc.FitImagesToPage();
	};

	/////////////////////////////////////////////////////////////
	///////// For table
	////////////////////////////////////////////////////////////
	PDFEditorApi.prototype.tblApply = function(oPr) {
		let oDoc = this.getPDFDoc();

		let oBorders = oPr.CellBorders;
		if (oPr.CellBorders){
			function fCheckBorder(oBorder) {
				if(!oBorder || !oBorder.Color)
					return;
				oBorder.Unifill =  AscFormat.CreateUnifillFromAscColor(oBorder.Color, 0);
			}
			fCheckBorder(oBorders.Left);
			fCheckBorder(oBorders.Top);
			fCheckBorder(oBorders.Right);
			fCheckBorder(oBorders.Bottom);
			fCheckBorder(oBorders.InsideH);
			fCheckBorder(oBorders.InsideV);
		}
		let oBackground = oPr.CellsBackground;
		if (oBackground && oBackground.Color) {
			if (oBackground.Value === Asc.c_oAscShd.Nil){
				oBackground.Value = Asc.c_oAscShd.Clear;
				oBackground.Unifill = AscFormat.CreateNoFillUniFill();
			}
			else {
				oBackground.Unifill = AscFormat.CreateUnifillFromAscColor(oBackground.Color, 0);
			}
		}
		oDoc.SetTableProps(oPr);
	};
	PDFEditorApi.prototype.asc_DistributeTableCells = function(isHorizontally) {
		let oDoc	= this.getPDFDoc();
		let bResult	= false;

		bResult = oDoc.DistributeTableCells(isHorizontally);
		return bResult;
	};
	PDFEditorApi.prototype.remColumn = function() {
		let oDoc = this.getPDFDoc();
		oDoc.RemoveTableColumn();
		return true;
	};
	PDFEditorApi.prototype.remTable = function() {
		let oDoc = this.getPDFDoc();
		let oGrFrame = oDoc.SelectTable(c_oAscTableSelectionType.Table);
		
		if (oGrFrame) {
			oDoc.RemoveDrawing(oGrFrame.GetId());
			return true;
		}

		return false;
	};
	PDFEditorApi.prototype.asc_getTableStylesPreviews = function(bUseDefault, arrIds) {
		let oDoc = this.getPDFDoc();

		this.private_CheckTableStylesPreviewGenerator();
		let arrPreviews = [];

		if (arrIds && arrIds.length) {
			let oStylesList = oDoc.GetTableStyles();
			for (let nIndex = 0, nCount = arrIds.length; nIndex < nCount; ++nIndex) {
				let oStyle   = oStylesList.Get(arrIds[nIndex]);
				let oPreview = this.TableStylesPreviewGenerator.GetPreview(oStyle);
				if (oPreview)
					arrPreviews.push(oPreview);
			}
		}
		else {
			arrPreviews = this.TableStylesPreviewGenerator.GetAllPreviews(bUseDefault);
		}

		return arrPreviews;
	};
	PDFEditorApi.prototype.asc_GetSelectionBounds = function() {
		return [[0,0], [0,0], [0,0], [0,0]];
	};

	PDFEditorApi.prototype.getPluginContextMenuInfo = function () {
		let oDoc		= this.getPDFDoc();
		let oController	= oDoc.GetController();
		
		return oController.getPluginSelectionInfo();
	};

	/////////////////////////////////////////////////////////////
	///////// For text
	////////////////////////////////////////////////////////////

	PDFEditorApi.prototype.SetTextEditMode = function(bEdit) {
		this.getPDFDoc().SetTextEditMode(bEdit);
	};
	PDFEditorApi.prototype.put_TextPrBold = function(value) {
		this.getPDFDoc().AddToParagraph(new AscCommonWord.ParaTextPr({Bold : value}));
	};
	PDFEditorApi.prototype.put_TextPrItalic = function(value) {
		this.getPDFDoc().AddToParagraph(new AscCommonWord.ParaTextPr({Italic : value}));
	};
	PDFEditorApi.prototype.put_TextPrUnderline = function(value) {
		this.getPDFDoc().AddToParagraph(new AscCommonWord.ParaTextPr({Underline : value}));
	};
	PDFEditorApi.prototype.put_TextPrStrikeout = function(value) {
		this.getPDFDoc().AddToParagraph(new AscCommonWord.ParaTextPr({
			Strikeout  : value,
			DStrikeout : false
		}));
	};
	PDFEditorApi.prototype.put_PrLineSpacing = function(nType, nValue) {
		this.getPDFDoc().SetParagraphSpacing({LineRule : nType, Line : nValue});
	};
	PDFEditorApi.prototype.put_LineSpacingBeforeAfter = function(type, value) { //"type == 0" means "Before", "type == 1" means "After"
		switch (type) {
			case 0:
				this.getPDFDoc().SetParagraphSpacing({Before : value});
				break;
			case 1:
				this.getPDFDoc().SetParagraphSpacing({After : value});
				break;
		}
	};
	PDFEditorApi.prototype.FontSizeIn = function() {
		this.getPDFDoc().IncreaseDecreaseFontSize(true);
	};
	PDFEditorApi.prototype.FontSizeOut = function() {
		this.getPDFDoc().IncreaseDecreaseFontSize(false);
	};
	// 0- baseline, 2-subscript, 1-superscript
	PDFEditorApi.prototype.put_TextPrBaseline = function(value) {
		this.getPDFDoc().AddToParagraph(new AscCommonWord.ParaTextPr({VertAlign : value}));
	};
	PDFEditorApi.prototype.put_TextPrFontSize = function(size) {
		this.getPDFDoc().AddToParagraph(new AscCommonWord.ParaTextPr({FontSize : Math.min(size, 300)}));
	};
	PDFEditorApi.prototype.put_TextPrFontName = function(name) {
		var loader   = AscCommon.g_font_loader;
		var fontinfo = AscFonts.g_fontApplication.GetFontInfo(name);
		var isasync  = loader.LoadFont(fontinfo);

		if (false === isasync) {
			this.getPDFDoc().AddToParagraph(new AscCommonWord.ParaTextPr({
				FontFamily : {
					Name  : name,
					Index : -1
				}
			}));
		}
	};
	PDFEditorApi.prototype.put_TextColor = function(color) {
		this.getPDFDoc().AddToParagraph(new AscCommonWord.ParaTextPr({
			Color : {
				r : color.r,
				g : color.g,
				b : color.b
			}
		}), false);
	};
	PDFEditorApi.prototype.asc_ChangeTextCase = function(nType) {
		this.getPDFDoc().ChangeTextCase(nType);
	};
	PDFEditorApi.prototype.put_PrAlign = function(nType) {
		this.getPDFDoc().SetParagraphAlign(nType);
	};
	PDFEditorApi.prototype.setVerticalAlign = function(nType) {
		this.getPDFDoc().SetVerticalAlign(nType);
	};
	PDFEditorApi.prototype.IncreaseIndent = function() {
		this.getPDFDoc().IncreaseDecreaseIndent(true);
	};
	PDFEditorApi.prototype.DecreaseIndent = function(){
		this.getPDFDoc().IncreaseDecreaseIndent(false);
	};
	PDFEditorApi.prototype.ClearFormating = function() {
		this.getPDFDoc().ClearParagraphFormatting(false, true);
	};
	PDFEditorApi.prototype.UpdateParagraphProp = function(oParaPr) {
		oParaPr.ListType = AscFormat.fGetListTypeFromBullet(oParaPr.Bullet);
		this.sync_ParaSpacingLine(oParaPr.Spacing);
		this.Update_ParaInd(oParaPr.Ind);
		this.sync_PrAlignCallBack(oParaPr.Jc);
		this.sync_ParaStyleName(oParaPr.StyleName);
		this.sync_ListType(oParaPr.ListType);
		this.sync_PrPropCallback(oParaPr);
	};

	/////////////////////////////////////////////////////////////
	///////// For text
	////////////////////////////////////////////////////////////

	PDFEditorApi.prototype.sync_ListType = function(NumPr) {
		this.sendEvent("asc_onListType", new AscCommon.asc_CListType(NumPr));
	};
	PDFEditorApi.prototype.ParseBulletPreviewInformation = function(arrDrawingInfo) {
		const arrNumberingLvls = [];
		AscFormat.ExecuteNoHistory(function ()
		{
			for (let i = 0; i < arrDrawingInfo.length; i += 1)
			{
				const oDrawInfo = arrDrawingInfo[i];
				const oNumberingInfo = oDrawInfo["numberingInfo"];
				if (!oNumberingInfo) continue;
				const sDivId = oDrawInfo["divId"];
				if (!oNumberingInfo["bullet"])
				{
					const oPresentationBullet = new AscCommonWord.CPresentationBullet();
					const oTextPr = new AscCommonWord.CTextPr();
					oPresentationBullet.m_sChar = AscCommon.translateManager.getValue("None");
					oPresentationBullet.m_nType = AscFormat.numbering_presentationnumfrmt_Char;
					oPresentationBullet.m_bFontTx = false;
					oPresentationBullet.m_sFont   = "Arial";
					oTextPr.Unifill = AscFormat.CreateSolidFillRGB(0, 0, 0);
					oTextPr.FontSize = oTextPr.FontSizeCS = 65;
					oPresentationBullet.MergeTextPr(oTextPr);
					arrNumberingLvls.push({divId: sDivId, arrLvls: [oPresentationBullet], isRemoving: true});
				}
				else
				{
					const oBullet = window['AscJsonConverter'].ReaderFromJSON.prototype.BulletFromJSON(oNumberingInfo["bullet"]);
					const oPresentationBullet = oBullet.getPresentationBullet(AscFormat.GetDefaultTheme(), AscFormat.GetDefaultColorMap());
					oPresentationBullet.m_bFontTx = false;
					const oTextPr = new AscCommonWord.CTextPr();
					oTextPr.Unifill = AscFormat.CreateSolidFillRGB(0, 0, 0);
					oTextPr.FontSize = oTextPr.FontSizeCS = 65;
					oPresentationBullet.MergeTextPr(oTextPr);
					arrNumberingLvls.push({divId: sDivId, arrLvls: [oPresentationBullet]});
				}
			}
		}, this);
		return arrNumberingLvls;
	};
	PDFEditorApi.prototype.put_ListType = function(type, subtype, custom) {
		let blipUrl = custom && custom.imageId;
		if (blipUrl) {
			let checkImageUrlFromServer;

			let that		= this;
			let localUrl	= AscCommon.g_oDocumentUrls.getLocal(blipUrl);
			let fullUrl		= AscCommon.g_oDocumentUrls.getUrl(blipUrl);

			if (fullUrl) {
				checkImageUrlFromServer = fullUrl;
			}
			else if (localUrl) {
				checkImageUrlFromServer = blipUrl;
			}

			if (checkImageUrlFromServer) {
				blipUrl			= checkImageUrlFromServer;
				custom.imageId	= blipUrl;

				let isImageNotAttendInImageLoader = !this.ImageLoader.map_image_index[blipUrl];
				if (isImageNotAttendInImageLoader) {
					let tryToSetImageBulletAgain = function () {
						that.put_ListType(type, subtype, custom);
					}
					this.ImageLoader.LoadImagesWithCallback([blipUrl], tryToSetImageBulletAgain);
					return;
				}
			}
			else {
				let changeBlipFillUrlToLocalAndTrySetImageBulletAgain = function (data) {
					let uploadImageUrl = data[0].url;
					custom.imageId = uploadImageUrl;
					that.put_ListType(type, subtype, custom);
				}
				AscCommon.sendImgUrls(this, [blipUrl], changeBlipFillUrlToLocalAndTrySetImageBulletAgain, false, custom.token);
				return;
			}
		}

		let oDoc = this.getPDFDoc();
		let NumberInfo = {
			Type:		type,
			SubType:	subtype,
			Custom:		custom
		};
		let oBullet = AscFormat.fGetPresentationBulletByNumInfo(NumberInfo);
		let sBullet = oBullet.asc_getSymbol();

		let fCallback = function() {
			oDoc.SetNumbering(oBullet);
		};

		if(typeof sBullet === "string" && sBullet.length > 0) {
			AscFonts.FontPickerByCharacter.checkText(sBullet, this, fCallback);
		}
		else {
			fCallback();
		}
	};
	PDFEditorApi.prototype._addImageUrl = function(arrUrls, oOptionObject) {
		let oDoc = this.getPDFDoc();
		
		if (oOptionObject) {
			if (oOptionObject.sendUrlsToFrameEditor && this.isOpenedChartFrame) {
				this.addImageUrlsFromGeneralToFrameEditor(arrUrls);
				return;
			}
			else if (oOptionObject.isImageChangeUrl || oOptionObject.isShapeImageChangeUrl || oOptionObject["obj"] || (oOptionObject instanceof AscCommon.CContentControlPr && oOptionObject.GetInternalId()) || oOptionObject.fAfterUploadOleObjectImage) {
				this.AddImageUrlAction(arrUrls[0], undefined, oOptionObject);
				return;
			}
		}

		if (this.ImageLoader) {
			const oApi = this;
			this.ImageLoader.LoadImagesWithCallback(arrUrls, function() {
				if (oOptionObject && oOptionObject.GetType() === AscPDF.FIELD_TYPES.button) {
					const oImage = oApi.ImageLoader.LoadImage(arrUrls[0], 1);
					if (oImage && oImage.Image) {
						oOptionObject.AddImage(oImage);
					}
				}
				else {
					const arrImages = [];
					for (let i = 0; i < arrUrls.length; ++i) {
						const oImage = oApi.ImageLoader.LoadImage(arrUrls[i], 1);
						if(oImage)  {
							arrImages.push(oImage);
						}
					}
					if (arrImages.length) {
						oDoc.CreateNewHistoryPoint();
						oDoc.AddImages(arrImages);
						oDoc.TurnOffHistory();
					}
				}
			}, []);
		}
	};
	PDFEditorApi.prototype.Paste = function()
	{
		if (AscCommon.g_clipboardBase.IsWorking())
			return false;

		return AscCommon.g_clipboardBase.Button_Paste();
	};
	PDFEditorApi.prototype.asc_setSkin = function(theme)
    {
        AscCommon.updateGlobalSkin(theme);

        if (this.isUseNativeViewer)
        {
            if (this.WordControl && this.WordControl.m_oDrawingDocument && this.WordControl.m_oDrawingDocument.m_oDocumentRenderer)
            {
                this.WordControl.m_oDrawingDocument.m_oDocumentRenderer.updateSkin();
            }
        }

        if (this.WordControl && this.WordControl.m_oBody)
        {
            this.WordControl.OnResize(true);
            if (this.WordControl.m_oEditor && this.WordControl.m_oEditor.HtmlElement)
            {
                this.WordControl.m_oEditor.HtmlElement.fullRepaint = true;
                this.WordControl.OnScroll();
            }
        }
    };
	PDFEditorApi.prototype.asc_SetTextFormDatePickerDate = function(oPr)
	{
		let oDoc = this.getPDFDoc();
		let oActiveForm = oDoc.activeForm;
		if (!oActiveForm)
			return;

		let oDate = new Asc.cDate(oPr.GetFullDate());
		let oCurDate = new Date();

		oDate.setMinutes(oCurDate.getMinutes());
		oDate.setSeconds(oCurDate.getSeconds());
		oDate.getMilliseconds(oCurDate.getMilliseconds());

		oDoc.lastDatePickerInfo = {
			value: AscPDF.FormatDateValue(oActiveForm.GetDateFormat(), oDate.getTime()),
			form: oActiveForm
		};

		oActiveForm.content.SelectAll();
		oActiveForm.EnterText(AscWord.CTextFormFormat.prototype.GetBuffer(oDoc.lastDatePickerInfo.value));
		oDoc.EnterDownActiveField();
		oDoc.lastDatePickerInfo = null;
	};
	PDFEditorApi.prototype.asc_SelectPDFFormListItem = function(sId) {
		let oViewer	= this.DocumentRenderer;
		let oDoc	= oViewer.getPDFDoc();
		let oField	= oDoc.activeForm;
		let nIdx	= parseInt(sId);
		if (!oField)
			return;
				
		oField.SelectOption(nIdx);
		if (oField.IsCommitOnSelChange() && oField.IsNeedCommit()) {
			oDoc.EnterDownActiveField();
		}
	};
	PDFEditorApi.prototype.SetDrawingFreeze = function(bIsFreeze)
	{
		if (!this.WordControl)
			return;

		this.WordControl.DrawingFreeze = bIsFreeze;

		var elem = document.getElementById("id_main");
		if (elem)
		{
			if (bIsFreeze)
			{
				elem.style.display = "none";
			}
			else
			{
				elem.style.display = "block";
			}
		}

		if (!bIsFreeze)
			this.WordControl.OnScroll();
	};
	// composite input
	PDFEditorApi.prototype.Begin_CompositeInput = function()
	{
		let viewer = this.DocumentRenderer;
		if (!viewer)
			return false;
		
		let pdfDoc = viewer.getPDFDoc();
		if (!pdfDoc.activeForm || !pdfDoc.activeForm.IsCanEditText())
			return false;
		
		function begin() {
			pdfDoc.activeForm.beginCompositeInput();
		}
		
		if (!pdfDoc.checkFieldFont(pdfDoc.activeForm, begin))
			return true;
		
		begin();
		return true;
	};
	PDFEditorApi.prototype.SetDocumentModified = function(bValue)
	{
		this.isDocumentModify = bValue;
		this.sendEvent("asc_onDocumentModifiedChanged");

		if (undefined !== window["AscDesktopEditor"])
		{
			window["AscDesktopEditor"]["onDocumentModifiedChanged"](bValue);
		}
	};
	PDFEditorApi.prototype.getAddedTextOnKeyDown = function() {
		return [];
	};
	PDFEditorApi.prototype.asc_getSelectedDrawingObjectsCount = function() {
		return this.WordControl.m_oLogicDocument.GetSelectedDrawingObjectsCount();
	};
	PDFEditorApi.prototype.isShowShapeAdjustments = function() {
		return true;
	};
	PDFEditorApi.prototype.Add_CompositeText = function(codePoint) {
		let form = this._getActiveForm();
		if (!form || !form.IsCanEditText())
			return;
		
		form.addCompositeText(codePoint);
	};
	PDFEditorApi.prototype.Remove_CompositeText = function(count) {
		let form = this._getActiveForm();
		if (!form || !form.IsCanEditText())
			return;
		
		form.removeCompositeText(count);
	};
	PDFEditorApi.prototype.Replace_CompositeText = function(codePoints) {
		let form = this._getActiveForm();
		if (!form || !form.IsCanEditText())
			return;
		
		form.replaceCompositeText(codePoints);
	};
	PDFEditorApi.prototype.End_CompositeInput = function()
	{
		let form = this._getActiveForm();
		if (!form || !form.IsCanEditText())
			return;
		
		form.endCompositeInput();
	};
	PDFEditorApi.prototype.Set_CursorPosInCompositeText = function(pos) {
		let form = this._getActiveForm();
		if (!form || !form.IsCanEditText())
			return;
		
		form.setPosInCompositeInput(pos);
	};
	PDFEditorApi.prototype.Get_CursorPosInCompositeText = function() {
		let form = this._getActiveForm();
		if (!form || !form.IsCanEditText())
			return 0;
		
		return form.getPosInCompositeInput();
	};
	PDFEditorApi.prototype.Get_MaxCursorPosInCompositeText = function() {
		let form = this._getActiveForm();
		if (!form || !form.IsCanEditText())
			return 0;
		
		return form.getMaxPosInCompositeInput();
	};
	PDFEditorApi.prototype._getActiveForm = function() {
		let viewer = this.DocumentRenderer;
		if (!viewer)
			return null;
		
		let pdfDoc = viewer.getPDFDoc();
		return pdfDoc.activeForm;
	};


	// for comments
	PDFEditorApi.prototype.can_AddQuotedComment = function()
	{
		return true;
	};
	PDFEditorApi.prototype.asc_addComment = function(AscCommentData)
	{
		var oDoc = this.getPDFDoc();
		if (!oDoc)
			return null;

		let oCommentData = new AscCommon.CCommentData();
		oCommentData.Read_FromAscCommentData(AscCommentData);

		oDoc.CreateNewHistoryPoint();
		let oComment = oDoc.AddComment(AscCommentData);
		oDoc.TurnOffHistory();
		
		if (oComment) {
			return oComment.GetId()
		}
	};
	PDFEditorApi.prototype.asc_showComments = function()
	{
		let oDoc = this.getPDFDoc();
		oDoc.HideShowAnnots(false);
	};

	PDFEditorApi.prototype.asc_hideComments = function()
	{
		let oDoc = this.getPDFDoc();
		oDoc.HideShowAnnots(true);
	};
	PDFEditorApi.prototype.UpdateTextPr = function(TextPr)
	{
		let oDoc = this.getPDFDoc();
		let oDrDoc = oDoc.GetDrawingDocument();

		if ("undefined" != typeof(TextPr))
		{
			if (TextPr.Color !== undefined)
			{
				oDrDoc.TargetCursorColor.R = TextPr.Color.r;
				oDrDoc.TargetCursorColor.G = TextPr.Color.g;
				oDrDoc.TargetCursorColor.B = TextPr.Color.b;
			}
			if (TextPr.Bold === undefined)
				TextPr.Bold = false;
			if (TextPr.Italic === undefined)
				TextPr.Italic = false;
			if (TextPr.Underline === undefined)
				TextPr.Underline = false;
			if (TextPr.Strikeout === undefined)
				TextPr.Strikeout = false;
			if (TextPr.FontFamily === undefined)
				TextPr.FontFamily = {Index : 0, Name : ""};
			if (TextPr.FontSize === undefined)
				TextPr.FontSize = "";

			this.sync_BoldCallBack(TextPr.Bold);
			this.sync_ItalicCallBack(TextPr.Italic);
			this.sync_UnderlineCallBack(TextPr.Underline);
			this.sync_StrikeoutCallBack(TextPr.Strikeout);
			this.sync_TextPrFontSizeCallBack(TextPr.FontSize);
			this.sync_TextPrFontFamilyCallBack(TextPr.FontFamily);

			if (TextPr.VertAlign !== undefined)
				this.sync_VerticalAlign(TextPr.VertAlign);
			if (TextPr.Spacing !== undefined)
				this.sync_TextSpacing(TextPr.Spacing);
			if (TextPr.DStrikeout !== undefined)
				this.sync_TextDStrikeout(TextPr.DStrikeout);
			if (TextPr.Caps !== undefined)
				this.sync_TextCaps(TextPr.Caps);
			if (TextPr.SmallCaps !== undefined)
				this.sync_TextSmallCaps(TextPr.SmallCaps);
			if (TextPr.Position !== undefined)
				this.sync_TextPosition(TextPr.Position);
			if (TextPr.Lang !== undefined)
				this.sync_TextLangCallBack(TextPr.Lang);

			if (TextPr.Unifill !== undefined)
			{
				this.sync_TextColor2(TextPr.Unifill);
			}

			if (AscCommon.isRealObject(TextPr.HighlightColor))
			{
				var oRGB = TextPr.HighlightColor.RGBA;
				this.sendEvent("asc_onTextHighLight", new AscCommon.CColor(oRGB.R, oRGB.G, oRGB.B));
			}
			else
			{
				this.sendEvent("asc_onTextHighLight", AscCommonWord.highlight_None);
			}
		}
	};
	PDFEditorApi.prototype.sync_TextColor2 = function(unifill)
	{
		var _color;
		if (unifill.fill == null)
			return;
		var color;
		if (unifill.fill.type == Asc.c_oAscFill.FILL_TYPE_SOLID)
		{
			_color    = unifill.getRGBAColor();
			color = AscCommon.CreateAscColor(unifill.fill.color);
			color.asc_putR(_color.R);
			color.asc_putG(_color.G);
			color.asc_putB(_color.B);
			this.sendEvent("asc_onTextColor", color);
		}
		else if (unifill.fill.type == Asc.c_oAscFill.FILL_TYPE_GRAD)
		{
			_color    = unifill.getRGBAColor();
			if(unifill.fill.colors[0] && unifill.fill.colors[0].color)
			{
				color = AscCommon.CreateAscColor(unifill.fill.colors[0].color);
			}
			else
			{
				color = new Asc.asc_CColor();
			}
			color.asc_putR(_color.R);
			color.asc_putG(_color.G);
			color.asc_putB(_color.B);
			this.sendEvent("asc_onTextColor", color);
		}
		else
		{
			_color    = unifill.getRGBAColor();
			color = new Asc.asc_CColor();
			color.asc_putR(_color.R);
			color.asc_putG(_color.G);
			color.asc_putB(_color.B);
			this.sendEvent("asc_onTextColor", color);
		}
	};
	PDFEditorApi.prototype.asc_getAnchorPosition = function()
	{
		let oViewer		= editor.getDocumentRenderer();
		let pageObject	= oViewer.getPageByCoords(AscCommon.global_mouseEvent.X - oViewer.x, AscCommon.global_mouseEvent.Y - oViewer.y);
		let nPage		= pageObject ? pageObject.index : oViewer.currentPage;

		let nScaleY			= oViewer.drawingPages[nPage].H / oViewer.file.pages[nPage].H;
        let nScaleX			= oViewer.drawingPages[nPage].W / oViewer.file.pages[nPage].W;
		let nCommentWidth	= 33 * nScaleX;
		let nCommentHeight	= 33 * nScaleY;
		let oDoc			= oViewer.getPDFDoc();

		if (!pageObject) {
			let oPos = AscPDF.GetGlobalCoordsByPageCoords(10, 10, nPage, true);
			oDoc.anchorPositionToAdd = {
				x: 10,
				y: 10
			};
			return new AscCommon.asc_CRect(oPos["X"] + nCommentWidth, oPos["Y"] + nCommentHeight / 2, 0, 0);
		}

		oDoc.anchorPositionToAdd = {
			x: pageObject.x,
			y: pageObject.y
		};

		if (oDoc.mouseDownAnnot) {
			let aRect = oDoc.mouseDownAnnot.GetRect();
			let oPos = AscPDF.GetGlobalCoordsByPageCoords(aRect[2], aRect[1] + (aRect[3] - aRect[1]) / 2, nPage, true);
			return new AscCommon.asc_CRect(oPos["X"], oPos["Y"], 0, 0);
		}
		
		return new AscCommon.asc_CRect(AscCommon.global_mouseEvent.X - oViewer.x, AscCommon.global_mouseEvent.Y - oViewer.y, 0, 0);
	};
	PDFEditorApi.prototype.asc_removeComment = function(Id)
	{
		let oDoc = this.getPDFDoc();
		if (!oDoc)
			return;

		oDoc.RemoveComment(Id);
	};
	PDFEditorApi.prototype.asc_changeComment = function(Id, AscCommentData)
	{
		var oDoc = this.getDocumentRenderer().getPDFDoc();
		if (!oDoc)
			return;

		var CommentData = new AscCommon.CCommentData();
		CommentData.Read_FromAscCommentData(AscCommentData);
		oDoc.EditComment(Id, CommentData);
	};
	PDFEditorApi.prototype.asc_selectComment = function(Id)
	{
		this.getPDFDoc().GoToAnnot(Id);
	};

	PDFEditorApi.prototype.asc_EditSelectAll = function()
	{
		let oViewer			= this.getDocumentRenderer();
		let oDoc			= oViewer.getPDFDoc();
		let oActiveForm		= oDoc.activeForm;
        let oActiveAnnot	= oDoc.mouseDownAnnot;

		if (oActiveForm && oActiveForm.IsCanEditText()) {
			oActiveForm.SelectAllText();
		}
		else if (oActiveAnnot && oActiveAnnot.IsFreeText() && oActiveAnnot.IsInTextBox()) {
            oActiveAnnot.SelectAllText();
		}
		else {
			oViewer.file.selectAll();
		}
		
		oDoc.UpdateCopyCutState();
	};
	PDFEditorApi.prototype.asc_showComment = function(Id)
	{
		if (Id instanceof Array)
			this.getPDFDoc().ShowComment(Id);
		else
			this.getPDFDoc().ShowComment([Id]);
	};
	// drawing pen
	PDFEditorApi.prototype.onInkDrawerChangeState = function() {
		const oViewer	= this.getDocumentRenderer();
		const oDoc		= this.getDocumentRenderer().getPDFDoc();

		if(!oDoc)
			return;

		oViewer.file.Selection = {
			Page1 : 0,
			Line1 : 0,
			Glyph1 : 0,

			Page2 : 0,
			Line2 : 0,
			Glyph2 : 0,

			IsSelection : false
		}

		oViewer.onUpdateOverlay();
		oViewer.DrawingObjects.onInkDrawerChangeState();
		oDoc.currInkInDrawingProcess = null;

		if (this.isInkDrawerOn()) {
			this.getPDFDoc().BlurActiveObject();
		}
		else {
			if (oViewer.MouseHandObject) {
				oViewer.setCursorType("pointer");
			}
			else {
				oViewer.setCursorType("default");
			}
		}
	};
	PDFEditorApi.prototype.UpdateInterfaceState = function()
	{
		let oDoc = this.getPDFDoc();
		if (oDoc)
			oDoc.UpdateInterface();
	};

	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	// Private area
	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	PDFEditorApi.prototype.initDocumentRenderer = function() {
		let documentRenderer = new AscCommon.CViewer(this.HtmlElementName, this);
		
		let _t = this;
		documentRenderer.registerEvent("onNeedPassword", function(){
			_t.sendEvent("asc_onAdvancedOptions", Asc.c_oAscAdvancedOptionsID.DRM);
		});
		documentRenderer.registerEvent("onStructure", function(structure){
			_t.sendEvent("asc_onViewerBookmarksUpdate", structure);
		});
		documentRenderer.registerEvent("onCurrentPageChanged", function(pageNum){
			_t.sendEvent("asc_onCurrentPage", pageNum);
		});
		documentRenderer.registerEvent("onPagesCount", function(pagesCount){
			_t.sendEvent("asc_onCountPages", pagesCount);
		});
		documentRenderer.registerEvent("onZoom", function(value, type){
			_t.WordControl.m_nZoomValue = ((value * 100) + 0.5) >> 0;
			_t.sync_zoomChangeCallback(_t.WordControl.m_nZoomValue, type);
		});
		
		documentRenderer.registerEvent("onFileOpened", function() {
			_t.disableRemoveFonts = true;
			_t.onDocumentContentReady();
			_t.bInit_word_control = true;
			
			var thumbnailsDivId = "thumbnails-list";
			if (document.getElementById(thumbnailsDivId))
			{
				documentRenderer.Thumbnails = new AscCommon.ThumbnailsControl(thumbnailsDivId);
				documentRenderer.setThumbnailsControl(documentRenderer.Thumbnails);
				
				documentRenderer.Thumbnails.registerEvent("onZoomChanged", function (value) {
					_t.sendEvent("asc_onViewerThumbnailsZoomUpdate", value);
				});
			}
			documentRenderer.isDocumentContentReady = true;
		});
		documentRenderer.registerEvent("onHyperlinkClick", function(url){
			_t.sendEvent("asc_onHyperlinkClick", url);
		});
		
		documentRenderer.ImageMap = {};
		documentRenderer.InitDocument = function() {};
		
		this.DocumentRenderer = documentRenderer;
		this.WordControl.m_oDrawingDocument.m_oDocumentRenderer = documentRenderer;
	};
	PDFEditorApi.prototype.haveThumbnails = function() {
		return !!(this.DocumentRenderer && this.DocumentRenderer.Thumbnails);
	};
	PDFEditorApi.prototype.updateDarkMode = function() {
		if (!this.DocumentRenderer)
			return;
		
		this.DocumentRenderer.updateDarkMode();
	};
	PDFEditorApi.prototype.SetHighlight = function(r, g, b, opacity) {
		let oViewer	= this.getDocumentRenderer();
		let oDoc	= this.getPDFDoc();
		oDoc.SetHighlight(r, g, b, opacity);

		oViewer.file.Selection = {
			Page1 : 0,
			Line1 : 0,
			Glyph1 : 0,

			Page2 : 0,
			Line2 : 0,
			Glyph2 : 0,

			IsSelection : false
		}
	};
	PDFEditorApi.prototype.SetStrikeout = function(r, g, b, opacity) {
		let oViewer	= this.getDocumentRenderer();
		let oDoc	= this.getPDFDoc();
		oDoc.SetStrikeout(r, g, b, opacity);

		oViewer.file.Selection = {
			Page1 : 0,
			Line1 : 0,
			Glyph1 : 0,

			Page2 : 0,
			Line2 : 0,
			Glyph2 : 0,

			IsSelection : false
		}
	};
	PDFEditorApi.prototype.SetUnderline = function(r, g, b, opacity) {
		let oViewer	= this.getDocumentRenderer();
		let oDoc	= this.getPDFDoc();
		oDoc.SetUnderline(r, g, b, opacity);

		oViewer.file.Selection = {
			Page1 : 0,
			Line1 : 0,
			Glyph1 : 0,

			Page2 : 0,
			Line2 : 0,
			Glyph2 : 0,

			IsSelection : false
		}
	};
	PDFEditorApi.prototype.updateSkin = function() {
		let obj_id_main = document.getElementById("id_main");
		if (obj_id_main) {
			obj_id_main.style.backgroundColor = AscCommon.GlobalSkin.BackgroundColor;
			document.getElementById("id_viewer").style.backgroundColor = AscCommon.GlobalSkin.BackgroundColor;
			document.getElementById("id_panel_right").style.backgroundColor = AscCommon.GlobalSkin.ScrollBackgroundColor;
			document.getElementById("id_horscrollpanel").style.backgroundColor = AscCommon.GlobalSkin.ScrollBackgroundColor;
		}
		
		if (!this.DocumentRenderer)
			return;
		
		this.DocumentRenderer.updateSkin();
	};
	PDFEditorApi.prototype._selectSearchingResults = function(isShow) {
		if (!this.DocumentRenderer)
			return;
		
		let oDoc = this.getPDFDoc();
		oDoc.SearchEngine.Show = isShow;
		this.DocumentRenderer.onUpdateOverlay();
	};
	PDFEditorApi.prototype._printDesktop = function(options) {
		if (!this.DocumentRenderer)
			return false;
		
		let desktopOptions = {};
		if (options && options.advancedOptions)
			desktopOptions["nativeOptions"] = options.advancedOptions.asc_getNativeOptions();
		
		let viewer = this.DocumentRenderer;
		if (window["AscDesktopEditor"] && !window["AscDesktopEditor"]["IsLocalFile"]() && window["AscDesktopEditor"]["SetPdfCloudPrintFileInfo"])
		{
			if (!window["AscDesktopEditor"]["IsCachedPdfCloudPrintFileInfo"]())
				window["AscDesktopEditor"]["SetPdfCloudPrintFileInfo"](AscCommon.Base64.encode(viewer.getFileNativeBinary()));
		}
		window["AscDesktopEditor"]["Print"](JSON.stringify(desktopOptions), viewer.savedPassword ? viewer.savedPassword : "");
		return true;
	};
	PDFEditorApi.prototype.asyncImagesDocumentEndLoaded = function() {
		this.ImageLoader.bIsLoadDocumentFirst = false;
		
		if (!this.DocumentRenderer)
			return;
		
		if (this.EndActionLoadImages === 1) {
			this.sync_EndAction(Asc.c_oAscAsyncActionType.BlockInteraction, Asc.c_oAscAsyncAction.LoadDocumentImages);
		}
		else if (this.EndActionLoadImages === 2) {
			if (this.isPasteFonts_Images)
				this.sync_EndAction(Asc.c_oAscAsyncActionType.BlockInteraction, Asc.c_oAscAsyncAction.LoadImage);
			else
				this.sync_EndAction(Asc.c_oAscAsyncActionType.Information, Asc.c_oAscAsyncAction.LoadImage);
		}
		
		this.EndActionLoadImages = 0;
		
		this.WordControl.m_oDrawingDocument.OpenDocument();
		
		this.LoadedObject = null;
		
		this.bInit_word_control = true;
		
		this.WordControl.InitControl();
		
		if (this.isViewMode)
			this.asc_setViewMode(true);
	};
	PDFEditorApi.prototype.Input_UpdatePos = function() {
		if (this.DocumentRenderer)
			this.WordControl.m_oDrawingDocument.MoveTargetInInputContext();
	};
	PDFEditorApi.prototype.OnMouseUp = function(x, y) {
		if (!this.DocumentRenderer)
			return;
		
		this.DocumentRenderer.onMouseUp(x, y);
	};

	// disable drop
	PDFEditorApi.prototype.isEnabledDropTarget = function() {
		return false;
	};
	PDFEditorApi.prototype.checkDocumentTitleFonts = function() {
		// Do not load any fonts
	};

	PDFEditorApi.prototype.getSelectionState = function()
	{
		return null;
	};
	PDFEditorApi.prototype.getSpeechDescription = function(prevState, action)
	{
		return null;
	};
	PDFEditorApi.prototype.GenerateStyles = function() {};
	/*----------------------------------------------------------------*/
	/*functions for working with table*/
	PDFEditorApi.prototype.put_Table = function(col, row, placeholder, sStyleId) {
		let oDoc = this.getPDFDoc();
		oDoc.CreateNewHistoryPoint();
		oDoc.AddTable(col, row, sStyleId, editor.getDocumentRenderer().currentPage);
		oDoc.TurnOffHistory();
	};
	PDFEditorApi.prototype.Resize = function() {
		if (!this.DocumentRenderer)
			return;
		this.DocumentRenderer.resize();
	};
	PDFEditorApi.prototype._openDocumentEndCallback = function() {
		this.sendMathToMenu();
		this.sendStandartTextures();
	};

	PDFEditorApi.prototype._waitPrint = function(actionType, options)
	{
		return false;
	};

	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	// Export
	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	window['Asc']['PDFEditorApi'] = PDFEditorApi;
	AscCommon.PDFEditorApi        = PDFEditorApi;
	
	PDFEditorApi.prototype['asc_setAdvancedOptions']       = PDFEditorApi.prototype.asc_setAdvancedOptions;
	PDFEditorApi.prototype['startGetDocInfo']              = PDFEditorApi.prototype.startGetDocInfo;
	PDFEditorApi.prototype['stopGetDocInfo']               = PDFEditorApi.prototype.stopGetDocInfo;
	PDFEditorApi.prototype['can_CopyCut']                  = PDFEditorApi.prototype.can_CopyCut;
	PDFEditorApi.prototype['asc_searchEnabled']            = PDFEditorApi.prototype.asc_searchEnabled;
	PDFEditorApi.prototype['asc_findText']                 = PDFEditorApi.prototype.asc_findText;
	PDFEditorApi.prototype['asc_endFindText']              = PDFEditorApi.prototype.asc_endFindText;
	PDFEditorApi.prototype['asc_isSelectSearchingResults'] = PDFEditorApi.prototype.asc_isSelectSearchingResults;
	PDFEditorApi.prototype['asc_StartTextAroundSearch']    = PDFEditorApi.prototype.asc_StartTextAroundSearch;
	PDFEditorApi.prototype['asc_SelectSearchElement']      = PDFEditorApi.prototype.asc_SelectSearchElement;
	PDFEditorApi.prototype['ContentToHTML']                = PDFEditorApi.prototype.ContentToHTML;
	PDFEditorApi.prototype['goToPage']                     = PDFEditorApi.prototype.goToPage;
	PDFEditorApi.prototype['getCountPages']                = PDFEditorApi.prototype.getCountPages;
	PDFEditorApi.prototype['getCurrentPage']               = PDFEditorApi.prototype.getCurrentPage;
	PDFEditorApi.prototype['asc_getPdfProps']              = PDFEditorApi.prototype.asc_getPdfProps;
	PDFEditorApi.prototype['asc_enterText']                = PDFEditorApi.prototype.asc_enterText;
	PDFEditorApi.prototype['asc_correctEnterText']         = PDFEditorApi.prototype.asc_correctEnterText;
	PDFEditorApi.prototype['asc_GetSelectedText']          = PDFEditorApi.prototype.asc_GetSelectedText;
	PDFEditorApi.prototype['asc_SelectPDFFormListItem']    = PDFEditorApi.prototype.asc_SelectPDFFormListItem;
	PDFEditorApi.prototype['asc_SetTextFormDatePickerDate']= PDFEditorApi.prototype.asc_SetTextFormDatePickerDate;
	PDFEditorApi.prototype['asc_getHeaderFooterProperties']= PDFEditorApi.prototype.asc_getHeaderFooterProperties;

	PDFEditorApi.prototype['SetDrawingFreeze']             = PDFEditorApi.prototype.SetDrawingFreeze;
	PDFEditorApi.prototype['OnMouseUp']                    = PDFEditorApi.prototype.OnMouseUp;

	PDFEditorApi.prototype['asc_addComment']               = PDFEditorApi.prototype.asc_addComment;
	PDFEditorApi.prototype['can_AddQuotedComment']         = PDFEditorApi.prototype.can_AddQuotedComment;
	PDFEditorApi.prototype['asc_showComments']             = PDFEditorApi.prototype.asc_showComments;
	PDFEditorApi.prototype['asc_showComment']              = PDFEditorApi.prototype.asc_showComment;
	PDFEditorApi.prototype['asc_hideComments']             = PDFEditorApi.prototype.asc_hideComments;
	PDFEditorApi.prototype['asc_removeComment']            = PDFEditorApi.prototype.asc_removeComment;
	PDFEditorApi.prototype['asc_changeComment']            = PDFEditorApi.prototype.asc_changeComment;
	PDFEditorApi.prototype['asc_selectComment']            = PDFEditorApi.prototype.asc_selectComment;
	PDFEditorApi.prototype['asc_EditText']                 = PDFEditorApi.prototype.asc_EditText;
	PDFEditorApi.prototype['asc_AddPage']                  = PDFEditorApi.prototype.asc_AddPage;
	PDFEditorApi.prototype['asc_RemovePage']			   = PDFEditorApi.prototype.asc_RemovePage;
	PDFEditorApi.prototype['asc_createSmartArt']		   = PDFEditorApi.prototype.asc_createSmartArt;

	PDFEditorApi.prototype['asc_setSkin']                  = PDFEditorApi.prototype.asc_setSkin;
	PDFEditorApi.prototype['asc_getAnchorPosition']        = PDFEditorApi.prototype.asc_getAnchorPosition;
	PDFEditorApi.prototype['SetMarkerFormat']              = PDFEditorApi.prototype.SetMarkerFormat;
	PDFEditorApi.prototype['get_PageWidth']                = PDFEditorApi.prototype.get_PageWidth;
	PDFEditorApi.prototype['get_PageHeight']               = PDFEditorApi.prototype.get_PageHeight;
	PDFEditorApi.prototype['SetTextEditMode']              = PDFEditorApi.prototype.SetTextEditMode;
	PDFEditorApi.prototype['asc_EditSelectAll']            = PDFEditorApi.prototype.asc_EditSelectAll;
	PDFEditorApi.prototype['Undo']                         = PDFEditorApi.prototype.Undo;
	PDFEditorApi.prototype['Redo']                         = PDFEditorApi.prototype.Redo;
	PDFEditorApi.prototype['UpdateInterfaceState']         = PDFEditorApi.prototype.UpdateInterfaceState;
	PDFEditorApi.prototype['asc_SelectionCut']             = PDFEditorApi.prototype.asc_SelectionCut;
	PDFEditorApi.prototype['asc_CheckCopy']                = PDFEditorApi.prototype.asc_CheckCopy;
	PDFEditorApi.prototype['Paste']                        = PDFEditorApi.prototype.Paste;
	PDFEditorApi.prototype['asc_PasteData']                = PDFEditorApi.prototype.asc_PasteData;

	PDFEditorApi.prototype['getSelectionState']            = PDFEditorApi.prototype.Paste;
	PDFEditorApi.prototype['getSpeechDescription']         = PDFEditorApi.prototype.asc_PasteData;

	// text/para pr
	PDFEditorApi.prototype['put_TextPrBold']				= PDFEditorApi.prototype.put_TextPrBold;
	PDFEditorApi.prototype['put_TextPrItalic']				= PDFEditorApi.prototype.put_TextPrItalic;
	PDFEditorApi.prototype['put_TextPrUnderline']			= PDFEditorApi.prototype.put_TextPrUnderline;
	PDFEditorApi.prototype['put_TextPrStrikeout']			= PDFEditorApi.prototype.put_TextPrStrikeout;
	PDFEditorApi.prototype['put_PrLineSpacing']				= PDFEditorApi.prototype.put_PrLineSpacing;
	PDFEditorApi.prototype['put_LineSpacingBeforeAfter']	= PDFEditorApi.prototype.put_LineSpacingBeforeAfter;
	PDFEditorApi.prototype['FontSizeIn']					= PDFEditorApi.prototype.FontSizeIn;
	PDFEditorApi.prototype['FontSizeOut']					= PDFEditorApi.prototype.FontSizeOut;
	PDFEditorApi.prototype['put_TextPrBaseline']			= PDFEditorApi.prototype.put_TextPrBaseline;
	PDFEditorApi.prototype['put_TextPrFontSize']			= PDFEditorApi.prototype.put_TextPrFontSize;
	PDFEditorApi.prototype['put_TextPrFontName']			= PDFEditorApi.prototype.put_TextPrFontName;
	PDFEditorApi.prototype['put_TextColor']					= PDFEditorApi.prototype.put_TextColor;
	PDFEditorApi.prototype['asc_ChangeTextCase']			= PDFEditorApi.prototype.asc_ChangeTextCase;
	PDFEditorApi.prototype['put_PrAlign']					= PDFEditorApi.prototype.put_PrAlign;
	PDFEditorApi.prototype['setVerticalAlign']				= PDFEditorApi.prototype.setVerticalAlign;
	PDFEditorApi.prototype['IncreaseIndent']				= PDFEditorApi.prototype.IncreaseIndent;
	PDFEditorApi.prototype['DecreaseIndent']				= PDFEditorApi.prototype.DecreaseIndent;
	PDFEditorApi.prototype['ClearFormating']				= PDFEditorApi.prototype.ClearFormating;
	PDFEditorApi.prototype['UpdateParagraphProp']			= PDFEditorApi.prototype.UpdateParagraphProp;
	PDFEditorApi.prototype['sync_ListType']					= PDFEditorApi.prototype.sync_ListType;
	PDFEditorApi.prototype['put_ListType']					= PDFEditorApi.prototype.put_ListType;

	// drawings
	PDFEditorApi.prototype['StartAddShape']				= PDFEditorApi.prototype.StartAddShape;
	PDFEditorApi.prototype['ShapeApply']				= PDFEditorApi.prototype.ShapeApply;
	PDFEditorApi.prototype['ChangeShapeType']			= PDFEditorApi.prototype.ChangeShapeType;
	PDFEditorApi.prototype['ImgApply']					= PDFEditorApi.prototype.ImgApply;
	PDFEditorApi.prototype['asc_FitImagesToPage']		= PDFEditorApi.prototype.asc_FitImagesToPage;
	PDFEditorApi.prototype['sync_shapePropCallback']	= PDFEditorApi.prototype.sync_shapePropCallback;
	PDFEditorApi.prototype['sync_annotPropCallback']	= PDFEditorApi.prototype.sync_annotPropCallback;
	PDFEditorApi.prototype['canUnGroup']				= PDFEditorApi.prototype.canUnGroup;
	PDFEditorApi.prototype['canGroup']					= PDFEditorApi.prototype.canGroup;
	PDFEditorApi.prototype['shapes_bringToFront']		= PDFEditorApi.prototype.shapes_bringToFront;
	PDFEditorApi.prototype['shapes_bringForward']		= PDFEditorApi.prototype.shapes_bringForward;
	PDFEditorApi.prototype['shapes_bringToBack']		= PDFEditorApi.prototype.shapes_bringToBack;
	PDFEditorApi.prototype['shapes_bringBackward']		= PDFEditorApi.prototype.shapes_bringBackward;


	// table
	PDFEditorApi.prototype['tblApply']						= PDFEditorApi.prototype.tblApply;
	PDFEditorApi.prototype['asc_DistributeTableCells']		= PDFEditorApi.prototype.asc_DistributeTableCells;
	PDFEditorApi.prototype['remColumn']						= PDFEditorApi.prototype.remColumn;
	PDFEditorApi.prototype['remTable']						= PDFEditorApi.prototype.remTable;
	PDFEditorApi.prototype['asc_getTableStylesPreviews']	= PDFEditorApi.prototype.asc_getTableStylesPreviews;
	PDFEditorApi.prototype['asc_GetSelectionBounds']		= PDFEditorApi.prototype.asc_GetSelectionBounds;

})(window, window.document);

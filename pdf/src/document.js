/*
 * (c) Copyright Ascensio System SIA 2010-2019
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
 * You can contact Ascensio System SIA at 20A-12 Ernesta Birznieka-Upisha
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

// TODO: Временно
var CPresentation = CPresentation || function(){};

(function(){

    /**
	 * event properties.
	 * @typedef {Object} oEventPr
	 * @property {string} [change=""] - A string specifying the change in value that the user has just typed. A JavaScript may replace part or all of this string with different characters. The change may take the form of an individual keystroke or a string of characters (for example, if a paste into the field is performed).
	 * @property {boolean} [rc=true] - Used for validation. Indicates whether a particular event in the event chain should succeed. Set to false to prevent a change from occurring or a value from committing. The default is true.
	 * @property {object} [target=undefined] - The target object that triggered the event. In all mouse, focus, blur, calculate, validate, and format events, it is the Field object that triggered the event. In other events, such as page open and close, it is the Doc or this object.
	 * @property {any} value ->
     *  This property has different meanings for different field events:
     *    For the Field/Validate event, it is the value that the field contains when it is committed. For a combo box, it is the face value, not the export value.  
     *    For a Field/Calculate event, JavaScript should set this property. It is the value that the field should take upon completion of the event.    
     *    For a Field/Format event, JavaScript should set this property. It is the value used when generating the appearance for the field. By default, it contains the value that the user has committed. For a combo box, this is the face value, not the export value.   
     *    For a Field/Keystroke event, it is the current value of the field. If modifying a text field, for example, this is the text in the text field before the keystroke is applied.
     *    For Field/Blur and Field/Focus events, it is the current value of the field. During these two events, event.value is read only. That is, the field value cannot be changed by setting event.value.
     * @property {boolean} willCommit -  Verifies the current keystroke event before the data is committed. It can be used to check target form field values to verify, for example, whether character data was entered instead of numeric data. JavaScript sets this property to true after the last keystroke event and before the field is validated.
	 */

    let AscPDF = window["AscPDF"];

    function CCalculateInfo(oDoc) {
        this.ids = [];
        this.document = oDoc;
        this.isInProgress = false;
        this.sourceField = null; // поле вызвавшее calculate
    };

    CCalculateInfo.prototype.AddFieldToOrder = function(id) {
        if (this.ids.includes(id) == false)
            this.ids.push(id);
    };
    CCalculateInfo.prototype.RemoveFieldFromOrder = function(id) {
        let nIdx = this.ids.indexOf(id);
        if (nIdx != -1) {
            this.ids.splice(nIdx, 1);
        }
    };
    CCalculateInfo.prototype.SetIsInProgress = function(bValue) {
        this.isInProgress = bValue;
    };
    CCalculateInfo.prototype.IsInProgress = function() {
        return this.isInProgress;
    };
    CCalculateInfo.prototype.SetCalculateOrder = function(aIds) {
        this.ids = aIds.slice();
    };
    /**
	 * Sets field to calc info, which caused the recalculation.
     * Note: This field cannot be changed in scripts.
	 * @memberof CBaseField
	 * @typeofeditors ["PDF"]
	 */
    CCalculateInfo.prototype.SetSourceField = function(oField) {
        this.sourceField = oField;
    };
    CCalculateInfo.prototype.GetSourceField = function() {
        return this.sourceField;
    };
	
	/**
	 * Main class for working with PDF structure
	 * @constructor
	 */
    function CPDFDoc(viewer) {
        this.rootFields = new Map(); // root поля форм
        this.widgets    = []; // непосредственно сами поля, которые отрисовываем (дочерние без потомков)
        this.annots     = [];
        this.textShapes = [];

        this.widgetsParents = []; // все родительские поля

        this.maxApIdx               = -1;
        this.theme                  = AscFormat.GenerateDefaultTheme(this);
        this.clrSchemeMap           = AscFormat.GenerateDefaultColorMap();
        this.styles                 = AscCommonWord.DEFAULT_STYLES.Copy();
        this.InitDefaultTextListStyles();

        this.actionsInfo            = new CActionQueue(this);
        this.calculateInfo          = new CCalculateInfo(this);
        this.fieldsToCommit         = [];
        this.event                  = {};
        this.lastDatePickerInfo     = null;
        this.AutoCorrectSettings    = new AscCommon.CAutoCorrectSettings();

        Object.defineProperties(this.event, {
            "change": {
                set: function(value) {
                    if (value != null && value.toString)
                        this._change = value.toString();
                },
                get: function() {
                    return this._change;
                }
            }
        });

        this._parentsMap = {}; // map при открытии форм
        this.api = this.GetDocumentApi();
		
        // internal
        this.activeForm         = null;
        this.activeTextShape    = null;
        this.mouseDownField     = null;
        this.mouseDownAnnot     = null;

        this.editMode = {
            text: false,
            forms: false
        }

        this._id = AscCommon.g_oIdCounter.Get_NewId();

        this.History        = AscCommon.History;
        this.LocalHistory   = new AscCommon.CHistory();

		this.Spelling   = new AscCommonWord.CDocumentSpellChecker();
        this.Viewer     = viewer;
        this.Api        = Asc.editor;

        this.annotsHidden = false;
		
		this.fontLoader             = AscCommon.g_font_loader;
		this.defaultFontsLoaded     = -1; // -1 не загружены и не грузим, 0 - грузим, 1 - загружены
		this.fontLoaderCallbacks    = [];
        this.loadedFonts            = [];
    }

    /////////// методы для открытия //////////////
    CPDFDoc.prototype.AddFieldToChildsMap = function(oField, nParentIdx) {
        if (this._parentsMap[nParentIdx] == null)
            this._parentsMap[nParentIdx] = [];

        this._parentsMap[nParentIdx].push(oField);
    };
    CPDFDoc.prototype.GetParentsMap = function() {
        return this._parentsMap;
    };
    CPDFDoc.prototype.OnEndFormsActions = function() {
        let oViewer = editor.getDocumentRenderer();
        if (oViewer.needRedraw == true) { // отключали отрисовку на скроле из ActionToGo, поэтому рисуем тут
            oViewer.paint();
            oViewer.needRedraw = false;
        }
        else {
            oViewer.paint();
        }
    };
    CPDFDoc.prototype.FillFormsParents = function(aParentsInfo) {
        let oChilds = this.GetParentsMap();
        let oParents = {};

        for (let i = 0; i < aParentsInfo.length; i++) {
            let nIdx = aParentsInfo[i]["i"];
            if (!oChilds[nIdx])
                continue;

            let sType = oChilds[nIdx][0].GetType();

            let oParent = private_createField(aParentsInfo[i]["name"], sType, undefined, undefined, this);
            if (aParentsInfo[i]["value"] != null)
                oParent.SetApiValue(aParentsInfo[i]["value"]);
            if (aParentsInfo[i]["Parent"] != null)
                this.AddFieldToChildsMap(oParent, aParentsInfo[i]["Parent"]);
            if (aParentsInfo[i]["defaultValue"] != null)
                oParent.SetDefaultValue(aParentsInfo[i]["defaultValue"]);
            if (aParentsInfo[i]["i"] != null)
                oParent.SetApIdx(aParentsInfo[i]["i"]);
            if (aParentsInfo[i]["curIdxs"])
                oParent.SetApiCurIdxs(aParentsInfo[i]["curIdxs"]);
            if (aParentsInfo[i]["Opt"] && oParent instanceof AscPDF.CBaseCheckBoxField)
                oParent.SetOptions(aParentsInfo[i]["Opt"]);

            oParents[nIdx] = oParent;
            this.rootFields.set(oParent.GetPartialName(), oParent);
            this.widgetsParents.push(oParent);
        }

        for (let nParentIdx in oParents) {
            oChilds[nParentIdx].forEach(function(child) {
                oParents[nParentIdx].AddKid(child);
            });
        }
    };
    CPDFDoc.prototype.SetLocalHistory = function() {
        AscCommon.History = this.LocalHistory;
    };
    CPDFDoc.prototype.SetGlobalHistory = function() {
        this.LocalHistory.Clear();
        AscCommon.History = this.History;
    };
    CPDFDoc.prototype.OnAfterFillFormsParents = function() {
        let bInberitValue = false;
        let value;

        let aRadios = []; // обновляем состояние радиокнопок в конце

        for (let i = 0; i < this.widgets.length; i++) {
            let oField = this.widgets[i];
            if ((oField.GetPartialName() == null || oField.GetApiValue(bInberitValue) == null) && oField.GetParent()) {
                let oParent = oField.GetParent();
                if (oParent.GetType() == AscPDF.FIELD_TYPES.radiobutton && oParent.IsAllKidsWidgets())
                    aRadios.push(oParent);

                value = oParent.GetApiValue(false);
                if (value != null && value.toString) {
                    value = value.toString();
                }

                if (oParent._currentValueIndices && oParent._currentValueIndices.length != 0) {
                    oField.SetCurIdxs(oParent._currentValueIndices);
                }
                else {
                    if (oField.GetType() !== AscPDF.FIELD_TYPES.radiobutton)
                        oField.SetValue(value, true);
                }
            }
        }

        aRadios.forEach(function(field) {
            field.GetKid(0).UpdateAll();
        });
    };
    CPDFDoc.prototype.FillButtonsIconsOnOpen = function() {
        let oViewer = editor.getDocumentRenderer();
        let oDoc = this;

        let aIconsToLoad = [];
        let oIconsInfo = {
            "MK": [],
            "View": []
        };

        for (let i = 0; i < oViewer.pagesInfo.pages.length; i++) {
            let oPage = oViewer.drawingPages[i];

            let w = (oPage.W * AscCommon.AscBrowser.retinaPixelRatio) >> 0;
            let h = (oPage.H * AscCommon.AscBrowser.retinaPixelRatio) >> 0;

            let oFile = oViewer.file;
            let oPageIconsInfo = oFile.nativeFile["getButtonIcons"](i, w, h, undefined, true);

            if (oPageIconsInfo["View"] == null)
                continue;

            oIconsInfo["MK"] = oIconsInfo["MK"].concat(oPageIconsInfo["MK"]);
            oIconsInfo["View"] = oIconsInfo["View"].concat(oPageIconsInfo["View"]);

            // load images
            for (let nIcon = 0; nIcon < oPageIconsInfo["View"].length; nIcon++) {
                let sBase64 = oPageIconsInfo["View"][nIcon]["retValue"];

                aIconsToLoad.push({
                    Image: {
                        width: oPageIconsInfo["View"][nIcon]["w"],
                        height: oPageIconsInfo["View"][nIcon]["h"],
                    },
                    src: "data:image/png;base64," + sBase64
                });

                for (let nField = 0; nField < oPageIconsInfo["MK"].length; nField++) {
                    if (oPageIconsInfo["MK"][nField]["I"] == oPageIconsInfo["View"][nIcon]["j"]) {
                        oPageIconsInfo["MK"][nField]["I"] = aIconsToLoad[aIconsToLoad.length - 1];
                    }
                    else if (oPageIconsInfo["MK"][nField]["RI"] == oPageIconsInfo["View"][nIcon]["j"]) {
                        oPageIconsInfo["MK"][nField]["RI"] = aIconsToLoad[aIconsToLoad.length - 1];
                    }
                    else if (oPageIconsInfo["MK"][nField]["IX"] == oPageIconsInfo["View"][nIcon]["j"]) {
                        oPageIconsInfo["MK"][nField]["IX"] = aIconsToLoad[aIconsToLoad.length - 1];
                    }
                }
            }
        }

        if (aIconsToLoad.length === 0) {
            oViewer.IsOpenFormsInProgress = false;
            return;
        }

        editor.ImageLoader.LoadImagesWithCallback(aIconsToLoad.map(function(info) {
            return info.src;
        }), function() {
            // выставляем только ImageData. Форму пересчитаем и добавим картинку после того, как форма изменится, чтобы не грузить шрифты
            for (let nBtn = 0; nBtn < oIconsInfo["MK"].length; nBtn++) {
                let oBtnField = oDoc.GetFieldBySourceIdx(oIconsInfo["MK"][nBtn]["i"]);

                if (oIconsInfo["MK"][nBtn]["I"]) {
                    oBtnField.SetImageData(oIconsInfo["MK"][nBtn]["I"]);
                }
                if (oIconsInfo["MK"][nBtn]["RI"]) {
                    oBtnField.SetImageData(oIconsInfo["MK"][nBtn]["RI"], AscPDF.APPEARANCE_TYPE.rollover);
                }
                if (oIconsInfo["MK"][nBtn]["IX"]) {
                    oBtnField.SetImageData(oIconsInfo["MK"][nBtn]["IX"], AscPDF.APPEARANCE_TYPE.mouseDown);
                }
            }
            oViewer.isRepaint = true;
            oViewer.IsOpenFormsInProgress = false;
        });
    };
    
    ////////////////////////////////////


    CPDFDoc.prototype.GetId = function() {
        return this._id;
    };
    CPDFDoc.prototype.Get_Id = function() {
        return this._id;
    };
    CPDFDoc.prototype.GetDrawingDocument = function() {
		if (!editor || !editor.WordControl)
			return null;
		
		return editor.WordControl.m_oDrawingDocument;
	};
	CPDFDoc.prototype.GetDocumentRenderer = function() {
		if (!editor)
			return null;
		
		return editor.getDocumentRenderer();
	};
    CPDFDoc.prototype.CommitFields = function() {
        this.skipHistoryOnCommit = true;
        this.fieldsToCommit.forEach(function(field) {
            field.Commit();
        });
        
        this.ClearFieldsToCommit();
        this.skipHistoryOnCommit = false;
    };
    CPDFDoc.prototype.ClearCacheForms = function(nPageIndex) {
        let oViewer = editor.getDocumentRenderer();

        if (oViewer.pagesInfo.pages[nPageIndex].fields != null) {
            oViewer.pagesInfo.pages[nPageIndex].fields.forEach(function(field) {
                field.ClearCache();
            });
        }

        oViewer.file.pages[nPageIndex].fieldsAPInfo = null;
    };
    CPDFDoc.prototype.ClearCacheAnnots = function(nPageIndex) {
        let oViewer = editor.getDocumentRenderer();

        if (oViewer.pagesInfo.pages[nPageIndex].annots != null) {
            oViewer.pagesInfo.pages[nPageIndex].annots.forEach(function(annot) {
                annot.ClearCache();
            });
        }
        
        oViewer.file.pages[nPageIndex].annotsAPInfo = null;
    };

    CPDFDoc.prototype.ClearCache = function(nPageIndex) {
        this.ClearCacheForms(nPageIndex);
        this.ClearCacheAnnots(nPageIndex);
    };
    CPDFDoc.prototype.IsNeedSkipHistory = function() {
        return !!this.skipHistoryOnCommit;
    };
    CPDFDoc.prototype.AddFieldToCommit = function(oField) {
        this.fieldsToCommit.push(oField);
    };
    CPDFDoc.prototype.ClearFieldsToCommit = function() {
        this.fieldsToCommit = [];
    };
    CPDFDoc.prototype.UpdateApIdx = function(newApIdx) {
        if (this.maxApIdx < newApIdx)
            this.maxApIdx = newApIdx;
    };
    CPDFDoc.prototype.GetMaxApIdx = function() {
        return this.maxApIdx;
    };
    CPDFDoc.prototype.SelectNextForm = function() {
        let oViewer         = editor.getDocumentRenderer();
        let oDrDoc          = this.GetDrawingDocument();
        let aWidgetForms    = this.widgets;
        let oActionsQueue   = this.GetActionsQueue();
		
		if (aWidgetForms.length == 0)
            return;

        let nCurIdx = this.widgets.indexOf(this.activeForm);
        let oCurForm = this.widgets[nCurIdx];
        let oNextForm;

        for (let i = nCurIdx + 1; i <= this.widgets.length; i++) {
            if (this.widgets[i]) {
                if (this.widgets[i].IsHidden() == false) {
                    oNextForm = this.widgets[i];
                    break;
                }
            }
            else {
                if (this.widgets[0] != oCurForm)
                    oNextForm = this.widgets[0];
                else
                    return;
            }
        }

        if (!oNextForm)
            return;

        let _t = this;
		if (!this.checkFieldFont(oNextForm, function(){_t.SelectNextForm();}))
			return;

        if (oCurForm) {
            if (oCurForm.IsNeedCommit()) {
                let isCommited = this.CommitField(oCurForm);
                if (!isCommited)
                    oNextForm = null;
            }
            else if (oCurForm.IsChanged() == false) {
                oCurForm.SetDrawFromStream(true);
            }

            if (oCurForm.IsNeedRevertShiftView()) {
                oCurForm.RevertContentViewToOriginal();
            }
            oCurForm.SetDrawHighlight(true);
            oCurForm.AddToRedraw();
            oCurForm.Blur();
            oCurForm.UpdateScroll && oCurForm.UpdateScroll(false);
        }
        
        this.activeForm = oNextForm;
        oNextForm.Recalculate();
        oNextForm.SetDrawHighlight(false);
        
        if (oNextForm.IsNeedDrawFromStream() == true && oNextForm.GetType() != AscPDF.FIELD_TYPES.button) {
            oNextForm.SetDrawFromStream(false);
        }
        
        oNextForm.onFocus();
        if (oNextForm.GetType() != AscPDF.FIELD_TYPES.button) {
            oNextForm.AddToRedraw();
        }

        let callbackAfterFocus = function() {
            oNextForm.SetInForm(true);

            switch (oNextForm.GetType()) {
                case AscPDF.FIELD_TYPES.text:
                case AscPDF.FIELD_TYPES.combobox:
                    this.SetLocalHistory();

                    oDrDoc.UpdateTargetFromPaint = true;
                    oDrDoc.m_lCurrentPage = 0;
                    oDrDoc.m_lPagesCount = oViewer.file.pages.length;
                    oDrDoc.showTarget(true);
                    oDrDoc.TargetStart();
                    if (oNextForm.content.IsSelectionUse())
                        oNextForm.content.RemoveSelection();
    
                    oNextForm.content.MoveCursorToStartPos();
                    oNextForm.content.RecalculateCurPos();
                    
                    break;
                default:
                    oDrDoc.TargetEnd();
                    break;
            }
        };
        
        if (false == oNextForm.IsInSight())
            this.NavigateToField(oNextForm);
                
        let oOnFocus = oNextForm.GetTrigger(AscPDF.FORMS_TRIGGERS_TYPES.OnFocus);
        // вызываем выставление курсора после onFocus. Если уже в фокусе, тогда сразу.
        if (oOnFocus && oOnFocus.Actions.length > 0)
            oActionsQueue.callbackAfterFocus = callbackAfterFocus.bind(this);
        else
            callbackAfterFocus.bind(this)();
    };
    CPDFDoc.prototype.SelectPrevForm = function() {
        let oViewer         = editor.getDocumentRenderer();
        let oDrDoc          = this.GetDrawingDocument();
        let aWidgetForms    = this.widgets;
        let oActionsQueue   = this.GetActionsQueue();
		
		if (aWidgetForms.length == 0)
            return;

        let nCurIdx = this.widgets.indexOf(this.activeForm);
        let oCurForm = this.widgets[nCurIdx];
        let oNextForm;

        for (let i = nCurIdx - 1; i >= -1; i--) {
            if (this.widgets[i]) {
                if (this.widgets[i].IsHidden() == false) {
                    oNextForm = this.widgets[i];
                    break;
                }
            }
            else {
                if (this.widgets[this.widgets.length - 1] != oCurForm)
                    oNextForm = this.widgets[this.widgets.length - 1];
                else
                    return;
            }
        }

        if (!oNextForm)
            return;

        let _t = this;
		if (!this.checkFieldFont(oNextForm, function(){_t.SelectNextForm();}))
			return;

        if (oCurForm) {
            if (oCurForm.IsNeedCommit()) {
                oCurForm.Commit();
            }
            else if (oCurForm.IsChanged() == false) {
                oCurForm.SetDrawFromStream(true);
            }

            if (oCurForm.IsNeedRevertShiftView()) {
                oCurForm.RevertContentViewToOriginal();
            }
            oCurForm.SetDrawHighlight(true);
            oCurForm.AddToRedraw();
            oCurForm.Blur();
            oCurForm.UpdateScroll && oCurForm.UpdateScroll(false);
        }
        
        this.activeForm = oNextForm;
        oNextForm.Recalculate();
        oNextForm.SetDrawHighlight(false);
        
        if (oNextForm.IsNeedDrawFromStream() == true && oNextForm.GetType() != AscPDF.FIELD_TYPES.button) {
            oNextForm.SetDrawFromStream(false);
        }
        
        oNextForm.onFocus();
        if (oNextForm.GetType() != AscPDF.FIELD_TYPES.button) {
            oNextForm.AddToRedraw();
        }

        let callbackAfterFocus = function() {
            oNextForm.SetInForm(true);

            switch (oNextForm.GetType()) {
                case AscPDF.FIELD_TYPES.text:
                case AscPDF.FIELD_TYPES.combobox:
                    this.SetLocalHistory();

                    oDrDoc.UpdateTargetFromPaint = true;
                    oDrDoc.m_lCurrentPage = 0;
                    oDrDoc.m_lPagesCount = oViewer.file.pages.length;
                    oDrDoc.showTarget(true);
                    oDrDoc.TargetStart();
                    if (oNextForm.content.IsSelectionUse())
                        oNextForm.content.RemoveSelection();
    
                    oNextForm.content.MoveCursorToStartPos();
                    oNextForm.content.RecalculateCurPos();
                    
                    break;
                default:
                    oDrDoc.TargetEnd();
                    break;
            }
        };

        // если форма не в видимой зоне, двигаемся к ней
        if (false == oNextForm.IsInSight())
            this.NavigateToField(oNextForm);
        
        let oOnFocus = oNextForm.GetTrigger(AscPDF.FORMS_TRIGGERS_TYPES.OnFocus);
        // вызываем выставление курсора после onFocus. Если уже в фокусе, тогда сразу.
        if (oOnFocus && oOnFocus.Actions.length > 0)
            oActionsQueue.callbackAfterFocus = callbackAfterFocus.bind(this);
        else
            callbackAfterFocus.bind(this)();
    };
    CPDFDoc.prototype.NavigateToField = function(oField) {
        let oViewer = editor.getDocumentRenderer();
        let aOrigRect = oField.GetOrigRect();
        let nPage = oField.GetPage();
        
        let nBetweenPages = oViewer.betweenPages / (oViewer.drawingPages[nPage].H / oViewer.file.pages[nPage].H);

        let nPageHpx = (oViewer.drawingPages[nPage].H * AscCommon.AscBrowser.retinaPixelRatio) >> 0;
        let nPageWpx = (oViewer.drawingPages[nPage].W * AscCommon.AscBrowser.retinaPixelRatio) >> 0;

        // находим видимый размер от страницы в исходных размерах 
        let nViewedH = (oViewer.canvas.height / nPageHpx) * oViewer.file.pages[nPage].H;
        let nViewedW = (oViewer.canvas.width / nPageWpx) * oViewer.file.pages[nPage].W;
        
        // выставляем смещение до формы страницу
        let yOffset = aOrigRect[1] + (aOrigRect[3] - aOrigRect[1]) / 2 - nViewedH / 2 + nBetweenPages;
        let xOffset = aOrigRect[0] + (aOrigRect[2] - aOrigRect[0]) / 2 - nViewedW / 2;

        oViewer.navigateToPage(nPage, yOffset > 0 ? yOffset : undefined, xOffset > 0 ? xOffset : undefined);
    };
    CPDFDoc.prototype.CommitField = function(oField) {
        let isValid = true;

        if (oField.IsNeedRevertShiftView()) {
            oField.RevertContentViewToOriginal();
        }

        if ([AscPDF.FIELD_TYPES.text, AscPDF.FIELD_TYPES.combobox].includes(oField.GetType())) {
            isValid = oField.DoValidateAction(oField.GetValue(true));
        }

        if (isValid) {
            oField.needValidate = false; 
            oField.Commit();
            if (this.event["rc"] == true && this.IsNeedDoCalculate()) {
                this.DoCalculateFields(oField);
                this.AddFieldToCommit(oField);
                this.CommitFields();
            }

            isValid = this.event["rc"];
        }
        else {
            oField.UndoNotAppliedChanges();
            if (oField.IsChanged() == false) {
                oField.SetDrawFromStream(true);
            }
        }

        oField.SetNeedCommit(false);
        return isValid;
    };
    CPDFDoc.prototype.EnterDownActiveField = function() {
        this.SetGlobalHistory();
        
        let oViewer = editor.getDocumentRenderer();
        let oDrDoc  = this.GetDrawingDocument();
        let oForm   = this.activeForm;

        if (!oForm)
            return;
        
        if (false == oForm.IsInForm())
            return;

        oForm.SetInForm(false);

        if ([AscPDF.FIELD_TYPES.checkbox, AscPDF.FIELD_TYPES.radiobutton].includes(oForm.GetType())) {
            oForm.onMouseUp();
        }
        else {
            oForm.SetDrawHighlight(true);
            oForm.UpdateScroll && oForm.UpdateScroll(false); // убираем скролл

            if (oForm.IsNeedRevertShiftView()) {
                oForm.RevertContentViewToOriginal();
            }

            if (oForm.IsNeedCommit()) {
                this.CommitField(oForm);
            }
            
            if (oForm.IsChanged() == false) {
                oForm.SetDrawFromStream(true);
            }

            if (oForm && oForm.content && oForm.content.IsSelectionUse()) {
                oForm.content.RemoveSelection();
                oViewer.onUpdateOverlay();
            }

            oDrDoc.TargetEnd(); // убираем курсор
            oForm.AddToRedraw();
        }
    };
    CPDFDoc.prototype.OnMouseDown = function(x, y, e) {
        Asc.editor.sendEvent('asc_onHidePdfFormsActions');

        let oViewer         = this.Viewer;
        if (!oViewer.canInteract()) {
            return;
        }

        let oDrawingObjects = oViewer.DrawingObjects;
        let oDrDoc          = this.GetDrawingDocument();

        let IsOnDrawer      = this.Api.isDrawInkMode();
        let IsOnEraser      = this.Api.isEraseInkMode();
        let IsOnAddAddShape = this.Api.isStartAddShape;

        let oMouseDownLink              = oViewer.getPageLinkByMouse();
        let oMouseDownField             = oViewer.getPageFieldByMouse();
        let oMouseDownAnnot             = oViewer.getPageAnnotByMouse();
        let oMouseDownTextShape         = oViewer.getPageTextShapeByMouse();

        // координаты клика на странице в MM
        let oPos    = oDrDoc.ConvertCoordsFromCursor2(x, y);
        let X       = oPos.X;
        let Y       = oPos.Y;
        
        // если ластик
        if (IsOnEraser) {
            if (oMouseDownAnnot && oMouseDownAnnot.IsInk()) {
                this.EraseInk(oMouseDownAnnot);
            }

            return;
        }
        // если добавление шейпа
        else if (IsOnAddAddShape) {
            oDrawingObjects.startAddShape(this.Api.addShapePreset);
            oDrawingObjects.OnMouseDown(e, X, Y, oPos.DrawPage);
            return;
        }
        // если рисование
        else if (IsOnDrawer == true || oViewer.Api.isMarkerFormat) {
            oDrawingObjects.OnMouseDown(e, X, Y, oPos.DrawPage);
            return;
        }
        
        let oCurObject = this.GetMouseDownObject();
        // оставляем текущий объет к селекте, если кликнули по нему же
        if (null == oCurObject || (oCurObject && false == [oMouseDownField, oMouseDownAnnot, oMouseDownTextShape, oMouseDownLink].includes(oCurObject)))
            this.SetMouseDownObject(oMouseDownField || oMouseDownAnnot || oMouseDownTextShape || oMouseDownLink);

        let oMouseDownObject = this.GetMouseDownObject();
        if (oMouseDownObject) {

            // если форма, то проверяем шрифт перед кликом в неё
            if (oMouseDownObject.IsForm() && false == [AscPDF.FIELD_TYPES.signature, AscPDF.FIELD_TYPES.checkbox , AscPDF.FIELD_TYPES.radiobutton].includes(oMouseDownObject.GetType())) {
                let _t = this;
                if (!this.checkFieldFont(oMouseDownObject, function(){_t.OnMouseDown(x, y, e)})) {
                    return;
                }

                if ((oMouseDownObject.IsNeedDrawFromStream() || oMouseDownObject.IsNeedRecalc()) && oMouseDownObject.GetType() != AscPDF.FIELD_TYPES.button) {
                    oMouseDownObject.Recalculate();
                    oMouseDownObject.SetNeedRecalc(true);
                }
            }

            oMouseDownObject.onMouseDown(x, y, e);

            if ((oMouseDownObject.IsTextShape() || (oMouseDownObject.IsAnnot() && oMouseDownObject.IsFreeText())) && false == oMouseDownObject.IsInTextBox()) {
                oDrDoc.TargetEnd();
            }
        }
        

        if (!oViewer.MouseHandObject && !this.mouseDownLinkObject) {
            oViewer.isMouseMoveBetweenDownUp = true;
            oViewer.onMouseDownEpsilon();
        }
        else if (this.mouseDownAnnot) {
            oViewer.onUpdateOverlay();
        }
        
        // если в селекте нет drawing (аннотации или шейпа) по которой кликнули, то сбрасываем селект
        if (oMouseDownObject == null || (false == oDrawingObjects.selectedObjects.includes(oMouseDownObject) && oDrawingObjects.selection.groupSelection != oMouseDownObject)) {
            oDrawingObjects.resetSelection();
        }
    };
    CPDFDoc.prototype.BlurActiveObject = function() {
        let oActiveObj = this.GetActiveObject();

        if (!oActiveObj)
            return;
        
        let oDrDoc          = this.GetDrawingDocument();
        let oDrawingObjects = this.Viewer.DrawingObjects;

        let oContent;
        if (oActiveObj.IsTextShape()) {
            oContent = oActiveObj.GetDocContent();

            oDrawingObjects.resetSelection();
            oActiveObj.SetInTextBox(false);
            this.activeTextShape = null;
        }
        else if (oActiveObj.IsForm()) {
            oContent = oActiveObj.GetDocContent();

            oActiveObj.SetDrawHighlight(true);
            oActiveObj.UpdateScroll && oActiveObj.UpdateScroll(false); // убираем скрол
            
            // если чекбокс то выходим сразу
            if ([AscPDF.FIELD_TYPES.checkbox, AscPDF.FIELD_TYPES.radiobutton, AscPDF.FIELD_TYPES.button].includes(oActiveObj.GetType())) {
                oActiveObj.SetPressed(false);
                oActiveObj.SetHovered(false);
                return;
            }
            else {
                if (oActiveObj.IsNeedCommit()) {
                    this.CommitField(oActiveObj);
                }
                else {
                    if (oActiveObj.IsChanged() == false) {
                        oActiveObj.SetDrawFromStream(true);
                    }
    
                    if (oActiveObj.IsNeedRevertShiftView()) {
                        oActiveObj.RevertContentViewToOriginal();
                    }
                }
            }
            
            oActiveObj.AddToRedraw();
            oActiveObj.Blur();
        }
        else if (oActiveObj.IsAnnot()) {
            if (oActiveObj.IsFreeText()) {
                oActiveObj.Blur();
            }

            this.mouseDownAnnot = null;
        }

        if (oContent) {
            oDrDoc.TargetEnd();
            if (oContent.IsSelectionUse()) {
                oContent.RemoveSelection();
            }
        }

        this.SetGlobalHistory();
        this.Viewer.onUpdateOverlay();
    };
    CPDFDoc.prototype.SetMouseDownObject = function(oObject) {
        if (!oObject) {
            this.BlurActiveObject();

            this.mouseDownField         = null;
            this.mouseDownAnnot         = null;
            this.activeTextShape        = null;
            this.mouseDownLinkObject    = null;
            return;
        }

        if (oObject.IsForm && oObject.IsForm()) {
            // если попали в другую форму, то выход из текущей
            if (this.mouseDownAnnot != this.activeForm) {
                this.BlurActiveObject();
            }

            this.mouseDownField         = oObject;
            this.mouseDownAnnot         = null;
            this.activeTextShape        = null;
            this.mouseDownLinkObject    = null;
        }
        else if (oObject.IsAnnot && oObject.IsAnnot()) {
            if (oObject != this.mouseDownAnnot) {
                this.BlurActiveObject();
            }

            this.mouseDownField         = null;
            this.mouseDownAnnot         = oObject;
            this.activeTextShape        = null;
            this.mouseDownLinkObject    = null;
        }
        else if (oObject.IsTextShape && oObject.IsTextShape()) {
            if (oObject != this.activeTextShape) {
                this.BlurActiveObject();
            }

            this.mouseDownField         = null;
            this.mouseDownAnnot         = null;
            this.activeTextShape        = oObject;
            this.mouseDownLinkObject    = null;
        }
        // значит Link object
        else {
            this.mouseDownField         = null;
            this.mouseDownAnnot         = null;
            this.activeTextShape        = null;
            this.mouseDownLinkObject    = oObject;
        }
    };
    
    CPDFDoc.prototype.SetTextEditMode = function(bEdit) {
        this.editMode.text = bEdit;
        this.editMode.forms = false;

        this.BlurActiveObject();
    };
    CPDFDoc.prototype.IsTextEditMode = function() {
        return this.editMode.text;
    };
    CPDFDoc.prototype.SetFormsEditMode = function(bEdit) {
        this.editMode.text = false;
        this.editMode.forms = bEdit;

        this.BlurActiveObject();
    };
    CPDFDoc.prototype.IsFormsEditMode = function() {
        return this.editMode.forms;
    };
    CPDFDoc.prototype.EraseInk = function(oInk) {
        this.RemoveAnnot(oInk.GetId());
    };

    CPDFDoc.prototype.OnMouseMove = function(x, y, e) {
        let oViewer         = editor.getDocumentRenderer();
        if (!oViewer.canInteract()) {
            return;
        }

        let oDrawingObjects = oViewer.DrawingObjects;
        let oDrDoc          = this.GetDrawingDocument();
        
        let IsOnDrawer      = this.Api.isDrawInkMode();
        let IsOnEraser      = this.Api.isEraseInkMode();
        let IsOnAddAddShape = this.Api.isStartAddShape;

        let oMouseMoveLink        = oViewer.getPageLinkByMouse();
        let oMouseMoveField       = oViewer.getPageFieldByMouse();
        let oMouseMoveAnnot       = oViewer.getPageAnnotByMouse();
        let oMouseMoveTextShape   = oViewer.getPageTextShapeByMouse();

        // координаты клика на странице в MM
        let oPos    = oDrDoc.ConvertCoordsFromCursor2(x, y);
        let X       = oPos.X;
        let Y       = oPos.Y;

        // при зажатой мышке
        if (oViewer.isMouseDown)
        {
            // под ластиком стираем только ink аннотации
            if (IsOnEraser) {
                if (oMouseMoveAnnot && oMouseMoveAnnot.IsInk()) {
                    this.EraseInk(oMouseMoveAnnot);
                }

                return;
            }
            // рисуем ink линию или добавляем фигугу
            else if (IsOnDrawer || IsOnAddAddShape) {
                oDrawingObjects.OnMouseMove(e, X, Y, oPos.DrawPage);
            }
            // обработка mouseMove в полях
            else if (this.activeForm) {
                // селект текста внутри формы с редаткриуемым текстом
                if ([AscPDF.FIELD_TYPES.text, AscPDF.FIELD_TYPES.combobox].includes(this.activeForm.GetType())) {
                    this.SelectionSetEnd(AscCommon.global_mouseEvent.X, AscCommon.global_mouseEvent.Y, e);
                }
                // отрисовка нажатого/отжатого состояния кнопок/чекбоксов при входе выходе мыши в форму
                else if ([AscPDF.FIELD_TYPES.button, AscPDF.FIELD_TYPES.checkbox, AscPDF.FIELD_TYPES.radiobutton].includes(this.activeForm.GetType())) {
                    if (oMouseMoveField != this.activeForm && this.activeForm.IsHovered()) {
                        this.activeForm.SetHovered(false);
                        this.activeForm.DrawUnpressed();
                    }
                    else if (oMouseMoveField == this.activeForm && this.activeForm.IsHovered() == false) {
                        this.activeForm.SetHovered(true);
                        this.activeForm.DrawPressed();
                    }
                }
            }
            else if (this.mouseDownAnnot) {
                // freetext это кастомный шейп со своими обработками взаимодействий, поэтому нужно вызывать свой preMove (не типичный шейп)
                if (this.mouseDownAnnot.IsFreeText()) {
                    if (this.mouseDownAnnot.IsInTextBox()) {
                        this.SelectionSetEnd(AscCommon.global_mouseEvent.X, AscCommon.global_mouseEvent.Y, e);
                    }
                    else {
                        this.mouseDownAnnot.onPreMove(e)
                    }
                }

                oDrawingObjects.OnMouseMove(e, X, Y, oPos.DrawPage);
            }
            else if (this.activeTextShape) {
                if (this.activeTextShape.IsInTextBox()) {
                    this.SelectionSetEnd(x, y, e);
                }
                else {
                    oDrawingObjects.OnMouseMove(e, X, Y, oPos.DrawPage);
                }
            }
        }
        else
        {
            // рисование и ластик работает только при зажатой мышке
            if (IsOnDrawer || IsOnEraser || IsOnAddAddShape)
                return;
            
            // действия mouseEnter и mouseExit у полей
            if (oMouseMoveField != this.mouseMoveField) {
                if (this.mouseMoveField) {
                    this.mouseMoveField.onMouseExit();
                }

                this.mouseMoveField = oMouseMoveField;
                if (oMouseMoveField)
                    oMouseMoveField.onMouseEnter();
            }
        }

        oViewer.onUpdateOverlay();
        this.UpdateCursorType(x, y, e);
    };
    CPDFDoc.prototype.UpdateCursorType = function(x, y, e) {
        let oViewer         = editor.getDocumentRenderer();
        let oDrawingObjects = oViewer.DrawingObjects;
        let oDrDoc          = this.GetDrawingDocument();
        
        let IsOnDrawer      = this.Api.isDrawInkMode();
        let IsOnEraser      = this.Api.isEraseInkMode();
        let IsOnAddAddShape = this.Api.isStartAddShape;

        let oMouseMoveLink        = oViewer.getPageLinkByMouse();
        let oMouseMoveField       = oViewer.getPageFieldByMouse();
        let oMouseMoveAnnot       = oViewer.getPageAnnotByMouse();
        let oMouseMoveTextShape   = oViewer.getPageTextShapeByMouse();

        // координаты клика на странице в MM
        let oPos    = oDrDoc.ConvertCoordsFromCursor2(x, y);
        let X       = oPos.X;
        let Y       = oPos.Y;

        let isCursorUpdated = oDrawingObjects.updateCursorType(oPos.DrawPage, X, Y, e, false);
        let oCursorInfo     = oDrawingObjects.getGraphicInfoUnderCursor(oPos.DrawPage, X, Y);
        let oCurObject      = this.GetActiveObject();

        // уже обновлён в oDrawingObjects
        if (oCurObject && oCurObject.GetId && oCursorInfo.objectId == oCurObject.GetId() && (!oCurObject.IsAnnot() || !oCurObject.IsComment())) {
            return true;
        }

        // курсор залочен для этих действий
        if (IsOnDrawer || IsOnEraser || IsOnAddAddShape)
            return true;

        let defaultCursor = oViewer.MouseHandObject ? AscCommon.Cursors.Grab : "default";
        let cursorType;

        if (oMouseMoveField) {
            let pageObject = oViewer.getPageByCoords3(x - oViewer.x, y - oViewer.y);
            if (!pageObject)
                return false;

            switch (oMouseMoveField.GetType()) {
                case AscPDF.FIELD_TYPES.text: {
                    cursorType = "text";
                    
                    if (oMouseMoveField.IsDateFormat() && oMouseMoveField.IsInForm()) {
                        // попадание в mark поля с датой
                        if (pageObject.x >= oMouseMoveField._markRect.x1 && pageObject.x <= oMouseMoveField._markRect.x2 && pageObject.y >= oMouseMoveField._markRect.y1 && pageObject.y <= oMouseMoveField._markRect.y2) {
                            cursorType = "pointer";
                        }
                    }
                    break;
                }
                case AscPDF.FIELD_TYPES.combobox: {
                    cursorType = "text";

                    // попадание в mark выбора элементов списка
                    if (pageObject.x >= oMouseMoveField._markRect.x1 && pageObject.x <= oMouseMoveField._markRect.x2 && pageObject.y >= oMouseMoveField._markRect.y1 && pageObject.y <= oMouseMoveField._markRect.y2 && oMouseMoveField._options.length != 0) {
                        cursorType = "pointer";
                    }
                    break;
                }
                default:
                    cursorType = "pointer";
            }
        }
        else if (oMouseMoveAnnot) {

            if (oMouseMoveAnnot.IsComment()) {
                cursorType = "move";
            }
            else if (oMouseMoveAnnot.IsTextMarkup()) {
                cursorType = "default";
            }
            else if (oMouseMoveAnnot.IsFreeText() && oMouseMoveAnnot.IsInTextBox()) {
                cursorType = "text";
            }
        }
        else if (oMouseMoveLink) {
            cursorType = "pointer";
        }

        // если не обновлен по drawing объектам и не задан по объектам из pdf то выставляем дефолтный
        if (cursorType == undefined) {
            if (isCursorUpdated == false) {
                cursorType = defaultCursor;
                oViewer.setCursorType(cursorType);
            }
        }
        else {
            oViewer.setCursorType(cursorType);
        }

        return true;
    };
    CPDFDoc.prototype.OnMouseUp = function(x, y, e) {
        let oViewer         = editor.getDocumentRenderer();
        if (!oViewer.canInteract()) {
            return;
        }
        
        let oDrawingObjects = oViewer.DrawingObjects;
        let oDrDoc          = this.GetDrawingDocument();
        
        let IsOnDrawer      = this.Api.isDrawInkMode();
        let IsOnEraser      = this.Api.isEraseInkMode();
        let IsOnAddAddShape = this.Api.isStartAddShape;

        let oMouseUpLink        = oViewer.getPageLinkByMouse();
        let oMouseUpField       = oViewer.getPageFieldByMouse();
        let oMouseUpAnnot       = oViewer.getPageAnnotByMouse();
        let oMouseUpTextShape   = oViewer.getPageTextShapeByMouse();

        // координаты клика на странице в MM
        let oPos    = oDrDoc.ConvertCoordsFromCursor2(x, y);
        let X       = oPos.X;
        let Y       = oPos.Y;

        // ластик работает на mousedown
        if (IsOnEraser) {
            return;
        }
        // если рисование или добавление шейпа то просто заканчиваем его
        else if (IsOnDrawer || IsOnAddAddShape) {
            oDrawingObjects.OnMouseUp(e, X, Y, oPos.DrawPage);
            return;
        }

        oDrawingObjects.OnMouseUp(e, X, Y, oPos.DrawPage);
        
        if (this.mouseDownField && oMouseUpField == this.mouseDownField) {
            this.OnMouseUpField(oMouseUpField, e);
        }
        else if (this.mouseDownAnnot && this.mouseDownAnnot == oMouseUpAnnot) {
            oMouseUpAnnot.onMouseUp(x, y, e);
        }
        else if (this.activeTextShape && this.activeTextShape == oMouseUpTextShape) {
            oMouseUpTextShape.onMouseUp(x, y, e);
            oDrawingObjects.updateCursorType(oPos.DrawPage, X, Y, e, false);
        }
        else if (this.mouseDownLinkObject && this.mouseDownLinkObject == oMouseUpLink) {
            oViewer.navigateToLink(oMouseUpLink);
        }
        
        e.IsLocked = false;

        this.UpdateCopyCutState();
        this.UpdateParagraphProps();
        this.UpdateTextProps();
        oViewer.onUpdateOverlay();
    };

    CPDFDoc.prototype.OnMouseUpField = function(oField) {
        oField.onMouseUp();
        
        if ([AscPDF.FIELD_TYPES.checkbox, AscPDF.FIELD_TYPES.radiobutton].includes(oField.GetType())) {
            if (oField.IsNeedCommit() && this.IsNeedDoCalculate()) {
                this.DoCalculateFields();
                this.CommitFields();
            }
        }
    };
    CPDFDoc.prototype.DoUndo = function() {
        let oDrDoc = this.GetDrawingDocument();

        let oActive = this.GetActiveObject();
        if (oActive) {
            let oContent = oActive.GetDocContent();
            if (oContent) {
                oContent.RemoveSelection();
            }
        }

        if (this.History.Can_Undo && !this.LocalHistory.Can_Undo())
            this.SetGlobalHistory();
        
        if (AscCommon.History.Can_Undo())
        {
            this.TurnOffHistory();
            this.isUndoRedoInProgress = true;
            this.currInkInDrawingProcess = null;

            let nCurPoindIdx = AscCommon.History.Index;
            let oCurPoint = AscCommon.History.Points[nCurPoindIdx];

            AscCommon.History.Undo();
            
            let aSourceObjects  = oCurPoint.Additional.Pdf;
            let isTextConvert   = oCurPoint.Additional.PdfConvertText;

            if (isTextConvert) {
                this.isConvertedToShapes = false;
                return;
            }

            if (!aSourceObjects) {
                this.isUndoRedoInProgress = false;
                return;
            }
               
            for (let i = 0; i < aSourceObjects.length; i++) {
                let oSourceObj = aSourceObjects[i];

                if (oSourceObj.IsForm()) {
                    // в глобальной истории должен срабатывать commit
                    if (AscCommon.History == this.History) {
                        oDrDoc.TargetEnd(); // убираем курсор
                            
                        // изменение кнопки не вызывает commit со всеми вытекающими (calculation)
                        if (oSourceObj.GetType() != AscPDF.FIELD_TYPES.button)
                            this.CommitField(oSourceObj);
                        
                        if (this.activeForm)
                        {
                            this.activeForm.UpdateScroll && this.activeForm.UpdateScroll(false);
                            this.activeForm.SetDrawHighlight(true);
                            this.activeForm = null;
                        }
                    }
    
                    oSourceObj.SetNeedRecalc(true);
                }
                else if (oSourceObj.IsAnnot() || oSourceObj.IsTextShape()) {
                    oSourceObj.SetNeedRecalc(true);
                }
            }
            
            this.isUndoRedoInProgress = false;
        }
    };
    CPDFDoc.prototype.DoRedo = function() {
        let oDrDoc = this.GetDrawingDocument();

        let oActive = this.GetActiveObject();
        if (oActive) {
            let oContent = oActive.GetDocContent();
            if (oContent) {
                oContent.RemoveSelection();
            }
        }

        if (this.History.Can_Redo && !this.LocalHistory.Can_Redo())
            this.SetGlobalHistory();

        if (AscCommon.History.Can_Redo())
        {
            this.TurnOffHistory();
            this.isUndoRedoInProgress = true;
            this.currInkInDrawingProcess = null;

            AscCommon.History.Redo();
            let nCurPoindIdx = AscCommon.History.Index;
            let oCurPoint = AscCommon.History.Points[nCurPoindIdx];

            let aSourceObjects  = oCurPoint.Additional.Pdf;
            let isTextConvert   = oCurPoint.Additional.PdfConvertText;

            if (isTextConvert) {
                this.isConvertedToShapes = true;
                return;
            }

            if (!aSourceObjects) {
                this.isUndoRedoInProgress = false;
                return;
            }

            for (let i = 0; i < aSourceObjects.length; i++) {
                let oSourceObj = aSourceObjects[i];

                if (oSourceObj.IsForm()) {
                    if (AscCommon.History == this.History) {
                        oDrDoc.TargetEnd(); // убираем курсор
                            
                        // изменение кнопки не вызывает commit со всеми вытекающими (calculation)
                        if (oSourceObj.GetType() != AscPDF.FIELD_TYPES.button)
                            this.CommitField(oSourceObj);
    
                        if (this.activeForm)
                        {
                            this.activeForm.UpdateScroll && this.activeForm.UpdateScroll(false);
                            this.activeForm.SetDrawHighlight(true);
                            this.activeForm = null;
                        }
                    }
    
                    oSourceObj.SetNeedRecalc(true);
                }
                else if (oSourceObj.IsAnnot() || oSourceObj.IsTextShape()) {
                    oSourceObj.SetNeedRecalc(true);
                }
            }

            this.isUndoRedoInProgress = false;
        }
    };
    
    /**
	 * Получает активный объект
	 */
    CPDFDoc.prototype.GetActiveObject = function() {
        return this.activeForm || this.mouseDownAnnot || this.activeTextShape;
    };
    /**
	 * Разница от предыдущего метода в том, что для полей будет полочено поле, в которое был клик, а не активное
     * так как после клика в поле, оно может перестать быть активный после выполнения каких либо actions
	 */
    CPDFDoc.prototype.GetMouseDownObject = function() {
        return this.mouseDownField || this.mouseDownAnnot || this.activeTextShape;
    };

    CPDFDoc.prototype.SetEvent = function(oEventPr) {
        if (oEventPr["target"] != null && oEventPr["target"] != this.event["target"])
            this.event["target"] = oEventPr["target"];

        if (oEventPr["rc"] != null)
            this.event["rc"] = oEventPr["rc"];
        else
            this.event["rc"] = true;

        if (oEventPr["change"] != null && oEventPr["change"] != this.event["change"])
            this.event["change"] = oEventPr["change"];
            
        if (oEventPr["value"] != null && oEventPr["value"] != this.event["value"])
            this.event["value"] = oEventPr["value"];

        if (oEventPr["willCommit"] != null)
            this.event["willCommit"] = oEventPr["willCommit"];

        if (oEventPr["willCommit"] != null)
            this.event["willCommit"] = oEventPr["willCommit"];

        if (oEventPr["selStart"] != null)
            this.event["selStart"] = oEventPr["selStart"];

        if (oEventPr["selEnd"] != null)
            this.event["selEnd"] = oEventPr["selEnd"];
    };
    CPDFDoc.prototype.SetWarningInfo = function(oInfo) {
        this.warningInfo = oInfo;
    };
    CPDFDoc.prototype.GetWarningInfo = function() {
        return this.warningInfo;
    };

    CPDFDoc.prototype.DoCalculateFields = function(oSourceField) {
		this.TurnOffHistory();
        
        // при изменении любого поля (с коммитом) вызывается calculate у всех
        let oThis = this;
        this.calculateInfo.SetIsInProgress(true);
        this.calculateInfo.SetSourceField(oSourceField);
        this.calculateInfo.ids.forEach(function(id) {
            let oField = oThis.GetFieldBySourceIdx(id);
            if (!oField)
                return;
            
            let oCalcTrigget = oField.GetTrigger(AscPDF.FORMS_TRIGGERS_TYPES.Calculate);
            if (oCalcTrigget == null && oField._kids[0]) {
                // to do: action действие должно быть в родителе одинаковых виджетов
                oCalcTrigget = oField._kids[0].GetTrigger(AscPDF.FORMS_TRIGGERS_TYPES.Calculate);
                if (oCalcTrigget)
                    oField = oField._kids[0];
            }
            let oActionRunScript = oCalcTrigget ? oCalcTrigget.GetActions()[0] : null;

            if (oActionRunScript) {
                oActionRunScript.RunScript();
                if (oField.IsNeedCommit()) {
                    oField.SetNeedRecalc(true);
                    oThis.fieldsToCommit.push(oField);
                }
            }
        });
        this.calculateInfo.SetIsInProgress(false);
        this.calculateInfo.SetSourceField(null);
    };
    CPDFDoc.prototype.IsNeedDoCalculate = function() {
        if (this.calculateInfo.ids.length > 0)
            return true;

        return false;
    }

    CPDFDoc.prototype.GetCalculateInfo = function() {
        return this.calculateInfo;
    };

    CPDFDoc.prototype.GetActionsQueue = function() {
        return this.actionsInfo;
    };
    
    CPDFDoc.prototype.EscapeForm = function() {
        this.SetGlobalHistory();
        if (this.activeForm && this.activeForm.IsNeedDrawHighlight() == false) {
            this.activeForm.UndoNotAppliedChanges();

            if (this.activeForm.IsChanged() == false)
                this.activeForm.SetDrawFromStream(true);

            this.activeForm.AddToRedraw();
            this.activeForm.SetDrawHighlight(true);
            this.GetDrawingDocument().TargetEnd();
        }
    };

    /**
	 * Adds a new page to the active document.
	 * @memberof CPDFDoc
	 * @typeofeditors ["PDF"]
     * @param {number} [nPos] - (optional) The page after which to add the new page in a 1-based page numbering
     * system. The default is the last page of the document. Use 0 to add a page before the
     * first page. An invalid page range is truncated to the valid range of pages.
     * @param {points} [nWidth=612] - (optional) The width of the page in points. The default value is 612.
     * @param {points} [nHeight=792] - (optional) The height of the page in points. The default value is 792.
	 * @returns {boolean}
	 */
    CPDFDoc.prototype.AddPage = function(nPos, nWidth, nHeight) {
        let oViewer = editor.getDocumentRenderer();
        let oFile   = oViewer.file;

        if (nPos === undefined || -1 === nPos)
            nPos = oFile.pages.length;
        if (nWidth === undefined)
            nWidth = 612;
        if (nHeight === undefined)
            nHeight = 792;

        oFile.pages.splice(nPos, 0, {
            W: nWidth,
            H: nHeight,
            fonts: [],
            Dpi: 72
        });
	
		oViewer.drawingPages.splice(nPos, 0, {
			X : 0,
			Y : 0,
			W : (oFile.pages[nPos].W * 96 / oFile.pages[nPos].Dpi) >> 0,
			H : (oFile.pages[nPos].H * 96 / oFile.pages[nPos].Dpi) >> 0,
			Image : undefined
		});

        if (oViewer.pagesInfo.pages.length == 0)
            oViewer.pagesInfo.setCount(1);
        else
            oViewer.pagesInfo.pages.splice(nPos, 0, new AscPDF.CPageInfo());

        for (let nPage = nPos + 1; nPage < oViewer.pagesInfo.pages.length; nPage++) {
            if (oViewer.pagesInfo.pages[nPage].fields) {
                oViewer.pagesInfo.pages[nPage].fields.forEach(function(field) {
                    field.SetPage(nPage);
                });
            }
            if (oViewer.pagesInfo.pages[nPage].annots) {
                oViewer.pagesInfo.pages[nPage].annots.forEach(function(annot) {
                    annot.SetPage(nPage);
                });
            }
        }
            
        oViewer.resize();
        oViewer.sendEvent("onPagesCount", oFile.pages.length);
    };
    /**
	 * Adds an interactive field to document.
	 * @memberof CPDFDoc
	 * @typeofeditors ["PDF"]
     * @param {String} cName - The name of the new field to create.
     * @param {"button" | "checkbox" | "combobox" | "listbox" | "radiobutton" | "signature" | "text"} cFieldType - The type of form field to create.
     * @param {Number} nPageNum - The 0-based index of the page to which to add the field.
     * @param {Array} aCoords - An array of four numbers in rotated user space that specifies the size and placement
        of the form field. These four numbers are the coordinates of the bounding rectangle,
        in the following order: upper-left x, upper-left y, lower-right x and lower-right y 
	 * @returns {AscPDF.CBaseField}
	 */
    CPDFDoc.prototype.AddField = function(cName, cFieldType, nPageNum, aCoords) {
        function checkValidParams(cFieldType, nPageNum, aCoords) {
            if (Object.values(AscPDF.FIELD_TYPES).includes(cFieldType) == false)
                return false;
            if (typeof(nPageNum) !== "number" || nPageNum < 0)
                return false;
            let isValidRect = true;
            if (Array.isArray(aCoords)) {
                for (let i = 0; i < 4; i++) {
                    if (typeof(aCoords[i]) != "number") {
                        isValidRect = false;
                        break;
                    }
                }
            }
            else
                isValidRect = false;

            if (!isValidRect)
                return false;
        }
        if (false == checkValidParams(cFieldType, nPageNum, aCoords))
            return null;

        let oViewer = editor.getDocumentRenderer();
        let nScaleY = oViewer.drawingPages[nPageNum].H / oViewer.file.pages[nPageNum].H / oViewer.zoom;
        let nScaleX = oViewer.drawingPages[nPageNum].W / oViewer.file.pages[nPageNum].W / oViewer.zoom;

        let aScaledCoords = [aCoords[0] * nScaleX, aCoords[1] * nScaleY, aCoords[2] * nScaleX, aCoords[3] * nScaleY];

        let oPagesInfo = oViewer.pagesInfo;
        if (!oPagesInfo.pages[nPageNum])
            return null;
        
        let oField = private_createField(cName, cFieldType, nPageNum, aScaledCoords, this);
        if (!oField)
            return null;

        oField._origRect = aCoords;

        this.widgets.push(oField);
        oField.SetNeedRecalc(true);

        if (oPagesInfo.pages[nPageNum].fields == null) {
            oPagesInfo.pages[nPageNum].fields = [];
        }
        oPagesInfo.pages[nPageNum].fields.push(oField);

        if (AscCommon.History.IsOn() == true)
            AscCommon.History.TurnOff();

        if (oViewer.IsOpenFormsInProgress == false) {
            oField.SyncField();
            oField.SetDrawFromStream(false);
        }

        return oField;
    };

    /**
	 * Adds an interactive field to document.
	 * @memberof CPDFDoc
	 * @typeofeditors ["PDF"]
     * @param {object} oProps - Annot props 
	 * @returns {AscPDF.CAnnotationBase}
	 */
    CPDFDoc.prototype.AddAnnot = function(oProps) {
        let oViewer = editor.getDocumentRenderer();
        let nPageNum = oProps.page;

        let oPagesInfo = oViewer.pagesInfo;
        if (!oPagesInfo.pages[nPageNum])
            return null;
        
        let oAnnot = CreateAnnotByProps(oProps, this);

        this.annots.push(oAnnot);
        oAnnot.SetNeedRecalc && oAnnot.SetNeedRecalc(true);

        oAnnot.SetDisplay(this.IsAnnotsHidden() ? window["AscPDF"].Api.Objects.display["hidden"] : window["AscPDF"].Api.Objects.display["visible"]);

        if (oPagesInfo.pages[nPageNum].annots == null) {
            oPagesInfo.pages[nPageNum].annots = [];
        }
        oPagesInfo.pages[nPageNum].annots.push(oAnnot);

        if (AscCommon.History.IsOn() == true)
            AscCommon.History.TurnOff();

        this.History.Add(new CChangesPDFDocumentAddItem(this, this.annots.length - 1, [oAnnot]));
        
        if (oProps.apIdx == null)
            oAnnot.SetApIdx(this.GetMaxApIdx() + 2);
        else
            oAnnot.SetApIdx(oProps.apIdx);

        oAnnot.AddToRedraw();
        return oAnnot;
    };
    CPDFDoc.prototype.AddComment = function(AscCommentData) {
        let oViewer     = editor.getDocumentRenderer();
        let pageObject  = oViewer.getPageByCoords3(AscCommon.global_mouseEvent.X - oViewer.x, AscCommon.global_mouseEvent.Y - oViewer.y);
        let nGrScale    = 1.25 * (96 / oViewer.file.pages[pageObject.index].Dpi);
        let posToAdd    = this.anchorPositionToAdd ? this.anchorPositionToAdd : {x: 10, y: 10};
        
        let X2 = posToAdd.x + 40 / nGrScale;
        let Y2 = posToAdd.y + 40 / nGrScale;

        let oProps = {
            rect:           [posToAdd.x, posToAdd.y, X2, Y2],
            page:           pageObject.index,
            name:           AscCommon.CreateGUID(),
            type:           AscPDF.ANNOTATIONS_TYPES.Text,
            author:         AscCommentData.m_sUserName,
            modDate:        AscCommentData.m_sOOTime,
            creationDate:   AscCommentData.m_sOOTime,
            contents:       AscCommentData.m_sText,
            hidden:         false
        }

        this.anchorPositionToAdd = null;

        let oStickyComm;
        if (this.mouseDownAnnot) {
            // если есть ответ, или это аннотация, где контент идёт как текста коммента то редактируем коммент
            if ((this.mouseDownAnnot.GetContents() && this.mouseDownAnnot.IsUseContentAsComment()) || this.mouseDownAnnot.GetReply(0) != null) {
                let newCommentData = new AscCommon.CCommentData();
                newCommentData.Read_FromAscCommentData(AscCommentData);

                let curCommentData = new AscCommon.CCommentData();
                curCommentData.Read_FromAscCommentData(this.mouseDownAnnot.GetAscCommentData());
                curCommentData.Add_Reply(newCommentData);

                this.EditComment(this.mouseDownAnnot.GetId(), curCommentData);
            }
            // если аннотация где контент идет как текст коммента и контента нет, то выставляем контент
            else if (this.mouseDownAnnot.GetContents() == null && this.mouseDownAnnot.IsUseContentAsComment()) {
                this.mouseDownAnnot.SetContents(AscCommentData.m_sText);
            }
            // остался вариант FreeText или line с выставленным cap (контекст идёт как текст внутри стрелки)
            // такому случаю выставляем ответ
            else {
                let oReply = CreateAnnotByProps(oProps, this);
                oReply.SetApIdx(this.GetMaxApIdx() + 2);

                this.mouseDownAnnot.SetReplies([oReply]);
            }
        }
        else {
            oStickyComm = this.AddAnnot(oProps);
            AscCommentData.m_sUserData = oStickyComm.GetApIdx();
            AscCommentData.m_sQuoteText = "";
            this.CheckComment(oStickyComm);
        }
        
        if (!oStickyComm)
            this.UpdateUndoRedo();
        
        return oStickyComm;
    };
    CPDFDoc.prototype.ConvertTextToShapes = function(nPage) {
        if (this.isConvertedToShapes) {
            return;
        }

        this.isConvertedToShapes = true;

        this.CreateNewHistoryPoint({isTextConvert: true});
        let oDrDoc = this.GetDrawingDocument();

        let aSpsXmls        = this.Viewer.file.nativeFile.scanPage(nPage);
        let oParserContext  = new AscCommon.XmlParserContext();
        let aPageShapes     = [];
        let oXmlReader;
        
        oParserContext.DrawingDocument = oDrDoc;

        AscFormat.ExecuteNoHistory(function () {
            for (let i = 0; i < aSpsXmls.length; i++) {
                let oPara   = new AscWord.Paragraph();
                let oRun    = new ParaRun(oPara);

                oXmlReader = new AscCommon.StaxParser(aSpsXmls[i], undefined, oParserContext);
                oXmlReader.ReadNextSiblingNode(0);
                oRun.fromXml(oXmlReader);
                
                oRun.GetAllDrawingObjects().forEach(function(paraDrawing) {
                    let oWordShape = paraDrawing.GraphicObj;

                    oWordShape.getXfrm().setOffX(paraDrawing.GetPositionH().Value);
                    oWordShape.getXfrm().setOffY(paraDrawing.GetPositionV().Value);
                    aPageShapes.push(oWordShape.convertToPdf(oDrDoc));
                });
            }
        }, this);

        let _t = this;
        aPageShapes.forEach(function(sp) {
            sp.SetFromScan(true);
            _t.AddTextShape(sp, nPage);
        });

        this.TurnOffHistory();
    };

    CPDFDoc.prototype.AddTextShape = function(oShape, nPage) {
        let oPagesInfo = this.Viewer.pagesInfo;
        if (!oPagesInfo.pages[nPage])
            return;

        this.textShapes.push(oShape);
        if (oPagesInfo.pages[nPage].textShapes == null) {
            oPagesInfo.pages[nPage].textShapes = [];
        }
        oPagesInfo.pages[nPage].textShapes.push(oShape);

        oShape.SetDocument(this);
        oShape.SetPage(nPage);

        AscFormat.ExecuteNoHistory(function () {
            if (oShape.GetDocContent() == null) {
                oShape.createTextBody();
            }
        }, this);

        this.History.Add(new CChangesPDFDocumentAddItem(this, this.textShapes.length - 1, [oShape]));

        oShape.AddToRedraw();
    };
    /**
	 * Обновляет позицию всплывающего окна комментария
	 * @memberof CPDFDoc
	 * @typeofeditors ["PDF"]
	 */
    CPDFDoc.prototype.UpdateCommentPos = function() {
        if (this.showedCommentId) {
            let oAnnot = this.GetAnnotById(this.showedCommentId);

            if (!oAnnot) {
                this.showedCommentId = undefined;
                return;
            }

            let oPos;
            if (oAnnot.IsComment()) 
                oPos = AscPDF.GetGlobalCoordsByPageCoords(oAnnot._pagePos.x + oAnnot._pagePos.w / this.Viewer.zoom, oAnnot._pagePos.y + oAnnot._pagePos.h / (2 * this.Viewer.zoom), oAnnot.GetPage(), true);
            else
                oPos = AscPDF.GetGlobalCoordsByPageCoords(oAnnot._pagePos.x + oAnnot._pagePos.w, oAnnot._pagePos.y + oAnnot._pagePos.h / 2, oAnnot.GetPage(), true);

            editor.sync_UpdateCommentPosition(oAnnot.GetId(), oPos["X"], oPos["Y"]);
        }
    };

    CPDFDoc.prototype.CreateNewHistoryPoint = function(oAdditional) {
        if (this.IsNeedSkipHistory() || this.Viewer.IsOpenFormsInProgress || this.Viewer.IsOpenAnnotsInProgress || this.isUndoRedoInProgress)
            return;

        if (AscCommon.History.IsOn() == false)
            AscCommon.History.TurnOn();

        AscCommon.History.Create_NewPoint();

        if (oAdditional) {
            if (oAdditional.isTextConvert) {
                AscCommon.History.SetPdfConvertTextPoint(true);
            }
            else if (oAdditional.objects) {
                AscCommon.History.SetSourceObjectsToPointPdf(oAdditional.objects);
            }
        }
    };
    CPDFDoc.prototype.EditComment = function(Id, CommentData) {
        let oAnnotToEdit = this.annots.find(function(annot) {
            return annot.GetId() === Id;
        });

        let oCurData = oAnnotToEdit.GetAscCommentData();

        this.History.Add(new CChangesPDFCommentData(oAnnotToEdit, oCurData, CommentData));
        
        oAnnotToEdit.EditCommentData(CommentData);
        editor.sync_ChangeCommentData(Id, CommentData);
    };
    CPDFDoc.prototype.CheckComment = function(oAnnot) {
        let bUseContentsAsComment = oAnnot.IsUseContentAsComment();
        
        if (oAnnot.IsUseInDocument()) {
            if ((bUseContentsAsComment && oAnnot.GetContents() != null) || (bUseContentsAsComment == false && oAnnot.GetReply(0) instanceof AscPDF.CAnnotationText)) {
                editor.sendEvent("asc_onAddComment", oAnnot.GetId(), oAnnot.GetAscCommentData());
            }
        }
    };
    CPDFDoc.prototype.TurnOffHistory = function() {
        if (AscCommon.History.IsOn() == true)
            AscCommon.History.TurnOff();
    }
    CPDFDoc.prototype.TurnOnHistory = function() {
        if (AscCommon.History.IsOn() == false)
            AscCommon.History.TurnOn();
    }
    CPDFDoc.prototype.ShowComment = function(arrId)
    {
        let oPos;
        var arrCommentsId = [];

        for (var nIndex = 0, nCount = arrId.length; nIndex < nCount; ++nIndex)
        {
            var oAnnot = this.GetAnnotById(arrId[nIndex]);
            if (oAnnot)
            {
                if (null == oPos)
                {
                    if (oAnnot.IsComment()) 
                        oPos = AscPDF.GetGlobalCoordsByPageCoords(oAnnot._pagePos.x + oAnnot._pagePos.w / this.Viewer.zoom, oAnnot._pagePos.y + oAnnot._pagePos.h / (2 * this.Viewer.zoom), oAnnot.GetPage(), true);
                    else
                        oPos = AscPDF.GetGlobalCoordsByPageCoords(oAnnot._pagePos.x + oAnnot._pagePos.w, oAnnot._pagePos.y + oAnnot._pagePos.h / 2, oAnnot.GetPage(), true);
                }

                arrCommentsId.push(oAnnot.GetId());
            }
        }

        if (null != oPos && arrCommentsId.length > 0)
        {
            editor.sync_ShowComment(arrCommentsId, oPos["X"], oPos["Y"]);
            this.showedCommentId = arrCommentsId[0];
        }
        else
        {
            editor.sync_HideComment();
            this.showedCommentId = undefined;
        }
    };
    
    CPDFDoc.prototype.Remove = function(nDirection, isCtrlKey) {
        let oDrDoc = this.GetDrawingDocument();

        let oForm       = this.activeForm;
        let oAnnot      = this.mouseDownAnnot;
        let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oTextShape  = this.activeTextShape;

        let oContent;
        if (oForm && oForm.IsCanEditText()) {
            oForm.Remove(nDirection, isCtrlKey);
            oContent = oForm.GetDocContent();
        }
        else if (oFreeText) {
            if (oFreeText.IsInTextBox()) {
                oFreeText.Remove(nDirection, isCtrlKey);
                oContent = oFreeText.GetDocContent();
            }
            else {
                this.RemoveAnnot(oFreeText.GetId());
            }
        }
        else if (oTextShape) {
            if (oTextShape.IsInTextBox()) {
                oTextShape.Remove(nDirection, isCtrlKey);
                oContent = oTextShape.GetDocContent();
            }
            else {
                this.RemoveTextShape(oTextShape.GetId());
            }
        }
        else if (nDirection == 1 && oAnnot && this.Viewer.isMouseDown == false) {
            this.RemoveAnnot(oAnnot.GetId());
        }

        if (oContent) {
            oDrDoc.TargetStart();
            oDrDoc.showTarget(true);
        }
    };
    CPDFDoc.prototype.EnterDown = function(isShiftKey) {
        let oDrDoc      = this.GetDrawingDocument();
        
        let oForm       = this.activeForm;
        let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oTextShape  = this.activeTextShape;

        let oContent;
        if (oForm) {
            if (oForm.GetType() == AscPDF.FIELD_TYPES.text && oForm.IsCanEditText() && oForm.IsMultiline()) {
                oForm.EnterText([13]);
                oContent = oForm.GetDocContent();
            }
            else {
                this.EnterDownActiveField();
            }
        }
        else if (oFreeText && oFreeText.IsInTextBox()) {
            oFreeText.AddNewParagraph();
            oContent = oFreeText.GetDocContent();
        }
        else if (oTextShape) {
            oTextShape.AddNewParagraph();
            oContent = oTextShape.GetDocContent();
        }

        if (oContent) {
            oDrDoc.showTarget(true);
            oDrDoc.TargetStart();
        }
    };
    
    CPDFDoc.prototype.RemoveComment = function(Id) {
        let oAnnot = this.annots.find(function(annot) {
            return annot.GetId() === Id;
        });

        if (!oAnnot)
            return;

        editor.sync_HideComment();
        if (oAnnot.IsComment()) {
            this.RemoveAnnot(oAnnot.GetId());
        }
        else {
            oAnnot.RemoveComment();
        }
    };
    CPDFDoc.prototype.RemoveAnnot = function(Id) {
        let oViewer = editor.getDocumentRenderer();
        let oAnnot = this.annots.find(function(annot) {
            return annot.GetId() === Id;
        });

        if (!oAnnot)
            return;

        let nPage = oAnnot.GetPage();
        oAnnot.AddToRedraw();

        let nPos        = this.annots.indexOf(oAnnot);
        let nPosInPage  = oViewer.pagesInfo.pages[nPage].annots.indexOf(oAnnot);

        this.annots.splice(nPos, 1);
        oViewer.pagesInfo.pages[nPage].annots.splice(nPosInPage, 1);
        
        if (this.mouseDownAnnot == oAnnot)
            this.mouseDownAnnot = null;

        this.CreateNewHistoryPoint();
        this.History.Add(new CChangesPDFDocumentRemoveItem(this, [nPos, nPosInPage], [oAnnot]));
        this.TurnOffHistory();

        editor.sync_HideComment();
        editor.sync_RemoveComment(Id);
        oViewer.DrawingObjects.resetSelection();
    };

    CPDFDoc.prototype.RemoveTextShape = function(Id) {
        let oViewer = editor.getDocumentRenderer();
        let oTextShape = this.textShapes.find(function(annot) {
            return annot.GetId() === Id;
        });

        if (!oTextShape)
            return;

        let nPage = oTextShape.GetPage();
        oTextShape.AddToRedraw();

        let nPos        = this.textShapes.indexOf(oTextShape);
        let nPosInPage  = oViewer.pagesInfo.pages[nPage].textShapes.indexOf(oTextShape);

        this.textShapes.splice(nPos, 1);
        oViewer.pagesInfo.pages[nPage].textShapes.splice(nPosInPage, 1);
        
        if (this.mouseDownAnnot == oTextShape)
            this.mouseDownAnnot = null;

        this.CreateNewHistoryPoint();
        this.History.Add(new CChangesPDFDocumentRemoveItem(this, [nPos, nPosInPage], [oTextShape]));
        this.TurnOffHistory();

        oViewer.DrawingObjects.resetSelection();
    };
    /**
	 * Move page to annot (if annot is't visible)
	 * @memberof CPDFDoc
	 * @typeofeditors ["PDF"]
     * @param {string} sId - id of annot.
     * @param {boolean} bForceMove - move to annot even it's visible.
     * @returns {object}
	 */
    CPDFDoc.prototype.GoToAnnot = function(sId, bForceMove) {
        let oAnnot = this.GetAnnotById(sId);
        if (!oAnnot)
            return;

        let nPage = oAnnot.GetPage();
        let aRect = oAnnot.GetOrigRect();

        let isVisible = false;
        let oPage;
        for (let i = 0; i < this.Viewer.pageDetector.pages.length; i++) {
            oPage = this.Viewer.pageDetector.pages[i];
            if (oPage.num == nPage) {
                let nScale = AscCommon.AscBrowser.retinaPixelRatio * this.Viewer.zoom * (96 / this.Viewer.file.pages[nPage].Dpi);
                let nPageY = -oPage.y / nScale;
                let nPageX = -oPage.x / nScale;

                let nVisibleH = (oPage.h - nPageY) / nScale;
                let nVisibleW = (oPage.w - nPageX) / nScale;

                // если рект аннотации попадает в рект видимого окна (положения страницы), то значит аннотация видима
                if ((aRect[3] > nPageY && aRect[1] < nPageY + nVisibleH) && (aRect[2] > nPageX && aRect[0] < nPageX + nVisibleW))
                    isVisible = true;
            }
        }

        if (isVisible == true && bForceMove != true)
            return;
        
        // выставляем смещения
        let yOffset;
        let xOffset;
        if (aRect[1] != null) {
            yOffset = aRect[1] + this.Viewer.betweenPages / (this.Viewer.drawingPages[nPage].H / this.Viewer.file.pages[nPage].H);
        }
        else
            yOffset = this.Viewer.betweenPages / (this.Viewer.drawingPages[nPage].H / this.Viewer.file.pages[nPage].H);

        if (aRect[0] != null) {
            xOffset = aRect[0];
        }

        if (yOffset != undefined && xOffset != undefined || this.Viewer.currentPage != nPage) {
            this.Viewer.disabledPaintOnScroll = true; // вырубаем отрисовку на скроле
            this.Viewer.navigateToPage(nPage, yOffset, xOffset);
            this.Viewer.disabledPaintOnScroll = false;
            this.Viewer.paint();
        }
    };
    CPDFDoc.prototype.HideComments = function() {
        editor.sync_HideComment();
        this.showedCommentId = undefined;
    };

    CPDFDoc.prototype.GetFieldBySourceIdx = function(nIdx) {
        for (let i = 0; i < this.widgets.length; i++) {
            if (this.widgets[i].GetApIdx() == nIdx) {
                return this.widgets[i];
            }
        }
        for (let i = 0; i < this.widgetsParents.length; i++) {
            if (this.widgetsParents[i].GetApIdx() == nIdx) {
                return this.widgetsParents[i];
            }
        }
    };
    CPDFDoc.prototype.GetAnnotById = function(sId) {
        return this.annots.find(function(annot) {
            return annot.GetId() == sId;
        });
    };
    CPDFDoc.prototype.GetShapeById = function(sId) {
        return this.textShapes.find(function(textShapes) {
            return textShapes.GetId() == sId;
        });
    };
    
    /**
	 * Changes the interactive field name.
	 * @memberof CPDFDoc
	 * @typeofeditors ["PDF"]
     * @param {AscPDF.CBaseField} oField - source field.
     * @param {String} cName - the new field name.
	 * @returns {AscPDF.CBaseField}
	 */
    CPDFDoc.prototype.private_changeFieldName = function(oField, cName) {
        while (cName.indexOf('..') != -1)
            cName = cName.replace(new RegExp("\.\.", "g"), ".");

        let oExistsWidget = this.GetField(cName);
        // если есть виджет-поле с таким именем то не добавляем 
        if (oExistsWidget && oExistsWidget.GetType() != oField.GetType())
            return null; // to do выдавать ошибку создания поля

        // получаем partial names
        let aPartNames = cName.split('.').filter(function(item) {
            if (item != "")
                return item;
        })

        // по формату не больше 20 вложенностей
        if (aPartNames.length > 20)
            return null;

        if (!oField._parent)
            return false;

        let oFieldParent = oField._parent;
        // удаляем поле из родителя
        oFieldParent.RemoveKid(oField);

        // создаем родительские поля, последнее будет виджет-полем
        if (aPartNames.length > 1) {
            if (this.rootFields.get(aPartNames[0]) == null) { // root поле
                this.rootFields.set(aPartNames[0], private_createField(aPartNames[0], oField.GetType(), oField.GetPage(), []));
            }

            let oParentField = this.rootFields.get(aPartNames[0]);
            
            for (let i = 1; i < aPartNames.length; i++) {
                // добавляем виджет-поле (то, которое рисуем)
                if (i == aPartNames.length - 1) {
                    oParentField.AddKid(oField);
                }
                else {
                    // если есть поле с таким именем (part name), то двигаемся дальше, если нет, то создаем
                    let oExistsField = oParentField.GetField(aPartNames[i]);
                    if (oExistsField)
                        oParentField = oExistsField;
                    else {
                        let oNewParent = private_createField(aPartNames[i], oField.GetType(), oField.GetPage(), []);
                        oParentField.AddKid(oNewParent);
                        oParentField = oNewParent;
                    }
                }
            }
        }

        this.private_checkField(oFieldParent);
        oField.SyncField();
        return oField;
    };
    CPDFDoc.prototype.DoTest = function() {
        let pdfDoc = this;
        let oViewer = editor.getDocumentRenderer();
	    	
        function CreateTextForm(name, aRect)
        {
            return pdfDoc.AddField(name, "text", 0, aRect);
        }
        function EnterTextToForm(form, text)
        {
            let chars = text.codePointsArray();
            pdfDoc.activeForm = form;
            form.EnterText(chars);
            pdfDoc.EnterDownActiveField();
        }
        function AddJsAction(form, trigger, script)
        {
            form.SetAction(trigger, script);
        }
	
        let textForm1 = CreateTextForm("TextForm1", [0, 0, 50, 50]);
		let textForm2 = CreateTextForm("TextForm2", [60, 0, 110, 50]);
		let textForm3 = CreateTextForm("TextForm3", [120, 0, 170, 50]);
		
		textForm1.GetFormApi().value = "1";
		textForm2.GetFormApi().value = "2";
		textForm3.GetFormApi().value = "3";
		
		AddJsAction(textForm1, AscPDF.FORMS_TRIGGERS_TYPES.Calculate, "this.getField('TextForm2').value += 1");
		AddJsAction(textForm2, AscPDF.FORMS_TRIGGERS_TYPES.Calculate, "this.getField('TextForm3').value += 1");
		AddJsAction(textForm3, AscPDF.FORMS_TRIGGERS_TYPES.Calculate, "this.getField('TextForm1').value += 1");
		
        textForm2.MoveCursorRight();
		EnterTextToForm(textForm2, "2");
		console.log(textForm1.GetValue(), "2", "Check form1 value");
		console.log(textForm2.GetValue(), "22", "Check form2 value");
		console.log(textForm3.GetValue(), "4", "Check form3 value");

        textForm3.MoveCursorRight();
		EnterTextToForm(textForm3, "3");
		
		console.log(textForm1.GetValue(), "3", "Check form1 value");
		console.log(textForm2.GetValue(), "23", "Check form2 value");
		console.log(textForm3.GetValue(), "43", "Check form3 value");
    }

    /**
	 * Changes the interactive field name.
     * Note: This method used by forms actions.
	 * @memberof CPDFDoc
     * @param {CBaseField[]} aNames - array with forms names to reset. If param is undefined or array is empty then resets all forms.
     * @param {boolean} bAllExcept - reset all fields except aNames
	 * @typeofeditors ["PDF"]
	 */
    CPDFDoc.prototype.ResetForms = function(aNames, bAllExcept) {
        let oActionsQueue = this.GetActionsQueue();
        let oThis = this;

        if (aNames.length > 0) {
            if (bAllExcept) {
                for (let nField = 0; nField < this.widgets.length; nField++) {
                    let oField = this.widgets[nField];
                    if (aNames.includes(oField.GetFullName()) == false)
                        oField.Reset();
                }
            }
            else {
                aNames.forEach(function(name) {
                    let aFields = oThis.GetAllWidgets(name);
                    if (aFields.length > 0)
                        AscCommon.History.Clear()
    
                    aFields.forEach(function(field) {
                        field.Reset();
                    });
                });
            }
        }
        else {
            this.widgets.forEach(function(field) {
                field.Reset();
            });
            if (this.widgets.length > 0)
                AscCommon.History.Clear()
        }

        oActionsQueue.Continue();
    };
    /**
	 * Hides/shows forms by names
	 * @memberof CPDFDoc
     * @param {boolean} bHidden
     * @param {AscPDF.CBaseField[]} aNames - array with forms names to reset. If param is undefined or array is empty then resets all forms.
	 * @typeofeditors ["PDF"]
	 * @returns {AscPDF.CBaseField}
	 */
    CPDFDoc.prototype.HideShowForms = function(bHidden, aNames) {
        let oActionsQueue = this.GetActionsQueue();
        let oThis = this;

        if (aNames.length > 0) {
            aNames.forEach(function(name) {
                let aFields = oThis.GetAllWidgets(name);
                aFields.forEach(function(field) {
                    if (bHidden)
                        field.SetDisplay(window["AscPDF"].Api.Objects.display["hidden"]);
                    else
                        field.SetDisplay(window["AscPDF"].Api.Objects.display["visible"]);
                    
                    field.AddToRedraw();
                });
            });
        }
        else {
            this.widgets.forEach(function(field) {
                if (bHidden)
                    field.SetDisplay(window["AscPDF"].Api.Objects.display["hidden"]);
                else
                    field.SetDisplay(window["AscPDF"].Api.Objects.display["visible"]);

                field.AddToRedraw();
            });
        }

        oActionsQueue.Continue();
    };

    /**
	 * Hides/shows annots by names
	 * @memberof CPDFDoc
     * @param {boolean} bHidden
	 * @typeofeditors ["PDF"]
	 * @returns {AscPDF.CAnnotationBase}
	 */
    CPDFDoc.prototype.HideShowAnnots = function(bHidden) {
        this.annots.forEach(function(annot) {
            annot.SetDisplay(bHidden ? window["AscPDF"].Api.Objects.display["hidden"] : window["AscPDF"].Api.Objects.display["visible"]);
            annot.AddToRedraw();
        });

        this.annotsHidden = bHidden;

        this.HideComments();
        this.mouseDownAnnot = null;
        this.Viewer.DrawingObjects.resetSelection();
    };
    CPDFDoc.prototype.IsAnnotsHidden = function() {
        return this.annotsHidden;
    };
    /**
	 * Checks the field for the field widget, if not then the field will be removed.
	 * @memberof CPDFDoc
	 * @typeofeditors ["PDF"]
	 */
    CPDFDoc.prototype.private_checkField = function(oField) {
        if (oField._kids.length == 0) {
            if (oField._parent) {
                oField._parent.RemoveKid(oField);
                this.private_checkField(oField._parent);
            }
            else if (this.rootFields.get(oField.name)) {
                this.rootFields.delete(oField.name);
            }
        }
    };

    /**
	 * Returns array with widgets fields by specified name.
	 * @memberof CPDFDoc
	 * @typeofeditors ["PDF"]
	 * @returns {boolean}
	 */
    CPDFDoc.prototype.GetAllWidgets = function(sName) {
        let aFields = [];
        for (let i = 0; i < this.widgets.length; i++) {
            if (this.widgets[i].GetFullName() == sName)
                aFields.push(this.widgets[i]);
        }

        if (aFields.length == 0) {
            for (let i = 0; i < this.widgetsParents.length; i++) {
                if (this.widgetsParents[i].GetFullName() == sName) {
                    aFields = aFields.concat(this.widgetsParents[i].GetAllWidgets());
                    break;
                }
            }
        }

        return aFields;
    };

    /**
	 * Gets API PDF doc.
	 * @memberof CPDFDoc
	 * @typeofeditors ["PDF"]
	 * @returns {boolean}
	 */
    CPDFDoc.prototype.GetDocumentApi = function() {
        if (this.api)
            return this.api;

        return new AscPDF.ApiDocument(this);
    };

    /**
	 * Gets field by name
	 * @memberof CPDFDoc
	 * @typeofeditors ["PDF"]
	 * @returns {?CBaseField}
	 */
    CPDFDoc.prototype.GetField = function(sName) {
        for (let i = 0; i < this.widgetsParents.length; i++) {
            if (this.widgetsParents[i].GetFullName() == sName) {
                return this.widgetsParents[i];
            }
        }

        let aPartNames = sName.split('.').filter(function(item) {
            if (item != "")
                return item;
        })

        let sPartName = aPartNames[0];
        for (let i = 0; i < aPartNames.length; i++) {
            for (let j = 0; j < this.widgets.length; j++) {
                if (this.widgets[j].GetFullName() == sPartName) // checks by fully name
                    return this.widgets[j];
            }
            sPartName += "." + aPartNames[i + 1];
        }

        return null;
    };

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	// Work with interface
	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	CPDFDoc.prototype.UpdateInterface = function() {
        this.UpdateUndoRedo();
        this.UpdateCommentPos();
        this.UpdateParagraphProps();
        this.UpdateTextProps();
        Asc.editor.CheckChangedDocument();
    };

    CPDFDoc.prototype.UpdateUndoRedo = function() {
		Asc.editor.sync_CanUndoCallback(this.History.Can_Undo() || this.LocalHistory.Can_Undo());
		Asc.editor.sync_CanRedoCallback(this.History.Can_Redo() || this.LocalHistory.Can_Redo());
    };
    CPDFDoc.prototype.UpdateCopyCutState = function() {
        let oCanCopyCut = this.CanCopyCut();
        editor.sync_CanCopyCutCallback(oCanCopyCut.copy, oCanCopyCut.cut);
    };
    CPDFDoc.prototype.CanCopyCut = function() {
        let oViewer         = editor.getDocumentRenderer();
        let oActiveForm     = this.activeForm;
        let oActiveAnnot    = this.mouseDownAnnot;

        let isCanCopy = false;
        let isCanCut = false;

        let oSelection = oViewer.file.Selection;
        if (oSelection.Glyph1 != oSelection.Glyph2 || oSelection.Line1 != oSelection.Line2 ||
            oSelection.Page1 != oSelection.Page2) {
                isCanCopy = true;
            }
        

        if (oActiveForm && oActiveForm.content && oActiveForm.content.IsSelectionUse() && 
            oActiveForm.content.IsSelectionEmpty() == false) {
                isCanCopy = true;
                isCanCut = true;
        }
        else if (oActiveAnnot && oActiveAnnot.IsFreeText() && oActiveAnnot.IsInTextBox() && oActiveAnnot.GetDocContent().IsSelectionUse()) {
            isCanCopy = true;
            isCanCut = true;
        }

        return {
            copy: isCanCopy,
            cut: isCanCut
        };
    };
    CPDFDoc.prototype.UpdateParagraphProps = function() {
        let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oTextShape  = this.activeTextShape;

        let oParaPr = new AscWord.CParaPr();

        let isCanIncreaseInd = false;
        let isCanDecreaseInd = false;

        if (oTextShape) {
            oParaPr = oTextShape.GetCalculatedParaPr();
            isCanIncreaseInd = oTextShape.GetDocContent().Can_IncreaseParagraphLevel(true);
            isCanDecreaseInd = oTextShape.GetDocContent().Can_IncreaseParagraphLevel(false);
        }
        
        Asc.editor.sendEvent("asc_canIncreaseIndent", isCanIncreaseInd);
	    Asc.editor.sendEvent("asc_canDecreaseIndent", isCanDecreaseInd);
        Asc.editor.UpdateParagraphProp(oParaPr);
    };
    CPDFDoc.prototype.UpdateTextProps = function() {
		let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oTextShape  = this.activeTextShape;

        let oTextPr = new AscWord.CTextPr();
        if (oTextShape) {
            oTextPr = oTextShape.GetCalculatedTextPr();
        }

        Asc.editor.UpdateTextPr(oTextPr);
    };

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	// Work with text
	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    CPDFDoc.prototype.MoveCursorLeft = function(isShiftKey, isCtrlKey) {
        let oDrDoc = this.GetDrawingDocument();

        let oForm       = this.activeForm;
        let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oTextShape  = this.activeTextShape;

        let oContent;
        if (oForm && oForm.IsInForm() && [AscPDF.FIELD_TYPES.text, AscPDF.FIELD_TYPES.combobox].includes(oForm.GetType())) {
            oForm.MoveCursorLeft(isShiftKey, isCtrlKey);
            oContent = oForm.GetDocContent();
        }
        else if (oFreeText && oFreeText.IsInTextBox()) {
            oFreeText.MoveCursorLeft(isShiftKey, isCtrlKey);
            oContent = oFreeText.GetDocContent();
        }
        else if (oTextShape && oTextShape.IsInTextBox()) {
            oTextShape.MoveCursorLeft(isShiftKey, isCtrlKey);
            oContent = oTextShape.GetDocContent();
        }

        if (oContent) {
            oDrDoc.TargetStart();
            // сбрасываем счетчик до появления курсора
            if (!isShiftKey) {
                oDrDoc.showTarget(true);
            }

            if (oContent.IsSelectionUse() && false == oContent.IsSelectionEmpty())
                oDrDoc.TargetEnd();

            this.Viewer.onUpdateOverlay();
        }
    };
    CPDFDoc.prototype.MoveCursorUp = function(isShiftKey, isCtrlKey) {
        let oDrDoc = this.GetDrawingDocument();

        let oForm       = this.activeForm;
        let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oTextShape  = this.activeTextShape;

        let oContent;
        if (oForm && !oForm.IsNeedDrawHighlight())
        {
            switch (oForm.GetType())
            {
                case AscPDF.FIELD_TYPES.listbox:
                    oForm.MoveSelectUp();
                    break;
                case AscPDF.FIELD_TYPES.text: {
                    if (oForm.IsInForm()) {
                        oForm.MoveCursorUp(isShiftKey, isCtrlKey);
                        oContent = oForm.GetDocContent();
                    }
                    break;
                }
            }
        }
        else if (oFreeText && oFreeText.IsInTextBox()) {
            oFreeText.MoveCursorUp(isShiftKey, isCtrlKey);
            oContent = oFreeText.GetDocContent();
        }
        else if (oTextShape && oTextShape.IsInTextBox()) {
            oTextShape.MoveCursorUp(isShiftKey, isCtrlKey);
            oContent = oTextShape.GetDocContent();
        }

        if (oContent) {
            oDrDoc.TargetStart();
            // сбрасываем счетчик до появления курсора
            if (!isShiftKey) {
                oDrDoc.showTarget(true);
            }

            if (oContent.IsSelectionUse() && false == oContent.IsSelectionEmpty())
                oDrDoc.TargetEnd();

            this.Viewer.onUpdateOverlay();
        }
    };
    CPDFDoc.prototype.MoveCursorRight = function(isShiftKey, isCtrlKey) {
        let oDrDoc = this.GetDrawingDocument();

        let oForm       = this.activeForm;
        let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oTextShape  = this.activeTextShape;

        let oContent;
        if (oForm && oForm.IsInForm() && [AscPDF.FIELD_TYPES.text, AscPDF.FIELD_TYPES.combobox].includes(oForm.GetType())) {
            oForm.MoveCursorRight(isShiftKey, isCtrlKey);
            oContent = oForm.GetDocContent();
        }
        else if (oFreeText && oFreeText.IsInTextBox()) {
            oFreeText.MoveCursorRight(isShiftKey, isCtrlKey);
            oContent = oFreeText.GetDocContent();
        }
        else if (oTextShape && oTextShape.IsInTextBox()) {
            oTextShape.MoveCursorRight(isShiftKey, isCtrlKey);
            oContent = oTextShape.GetDocContent();
        }

        if (oContent) {
            oDrDoc.TargetStart();
            // сбрасываем счетчик до появления курсора
            if (!isShiftKey) {
                oDrDoc.showTarget(true);
            }

            if (oContent.IsSelectionUse() && false == oContent.IsSelectionEmpty())
                oDrDoc.TargetEnd();

            this.Viewer.onUpdateOverlay();
        }
    };
    CPDFDoc.prototype.MoveCursorDown = function(isShiftKey, isCtrlKey) {
        let oDrDoc = this.GetDrawingDocument();

        let oForm       = this.activeForm;
        let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oTextShape  = this.activeTextShape;

        let oContent;
        if (oForm && !oForm.IsNeedDrawHighlight())
        {
            switch (oForm.GetType())
            {
                case AscPDF.FIELD_TYPES.listbox:
                    oForm.MoveSelectDown();
                    break;
                case AscPDF.FIELD_TYPES.text: {
                    if (oForm.IsInForm()) {
                        oForm.MoveCursorDown(isShiftKey, isCtrlKey);
                        oContent = oForm.GetDocContent();
                    }
                    
                    break;
                }
            }
            
        }
        else if (oFreeText && oFreeText.IsInTextBox()) {
            oFreeText.MoveCursorDown(isShiftKey, isCtrlKey);
            oContent = oFreeText.GetDocContent();
        }
        else if (oTextShape && oTextShape.IsInTextBox()) {
            oTextShape.MoveCursorDown(isShiftKey, isCtrlKey);
            oContent = oTextShape.GetDocContent();
        }

        if (oContent) {
            oDrDoc.TargetStart();
            // сбрасываем счетчик до появления курсора
            if (!isShiftKey) {
                oDrDoc.showTarget(true);
            }

            if (oContent.IsSelectionUse() && false == oContent.IsSelectionEmpty())
                oDrDoc.TargetEnd();

            this.Viewer.onUpdateOverlay();
        }
    };
    CPDFDoc.prototype.SelectAll = function() {
        let oDrDoc = this.GetDrawingDocument();

        let oForm       = this.activeForm;
        let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oTextShape  = this.activeTextShape;

        let oContent;
        if (oForm && oForm.IsInForm() && [AscPDF.FIELD_TYPES.text, AscPDF.FIELD_TYPES.combobox].includes(oForm.GetType())) {
            oForm.SelectAllText();
            oContent = oForm.GetDocContent();
        }
        else if (oFreeText && oFreeText.IsInTextBox()) {
            oFreeText.SelectAllText();
            oContent = oFreeText.GetDocContent();
        }
        else if (oTextShape) {
            oTextShape.SelectAllText();
            oContent = oTextShape.GetDocContent();
        }

        if (oContent) {
            if (oContent.IsSelectionUse() && !oContent.IsSelectionEmpty()) {
                oDrDoc.TargetEnd();
                this.Viewer.onUpdateOverlay();
            }
            else {
                oContent.RemoveSelection();
            }
        }
        else {
            if (!this.Viewer.isFullTextMessage) {
                if (!this.Viewer.isFullText)
                {
                    this.Viewer.fullTextMessageCallbackArgs = [];
                    this.Viewer.fullTextMessageCallback = function() {
                        this.Viewer.file.selectAll();
                    };
                    this.Viewer.showTextMessage();
                }
                else
                {
                    this.Viewer.file.selectAll();
                }
            }
        }
    };
    CPDFDoc.prototype.SelectionSetStart = function(x, y, e) {
        let oDrDoc      = this.GetDrawingDocument();
        let oForm       = this.activeForm;
        let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oTextShape  = this.activeTextShape;

        let oPos    = oDrDoc.ConvertCoordsFromCursor2(x, y);
        let X       = oPos.X;
        let Y       = oPos.Y;

        if (oForm && oForm.IsInForm() && [AscPDF.FIELD_TYPES.text, AscPDF.FIELD_TYPES.combobox].includes(oForm.GetType())) {
            oForm.SelectionSetStart(X, Y, e);
            if (false == this.Viewer.isMouseDown) {
                oForm.content.RemoveSelection();
            }
        }
        else if (oFreeText && oFreeText.IsInTextBox()) {
            oFreeText.SelectionSetStart(X, Y, e);
        }
        else if (oTextShape) {
            oTextShape.SelectionSetStart(X, Y, e);
        }
        
        oDrDoc.UpdateTargetFromPaint = true;
        oDrDoc.TargetStart();
        oDrDoc.showTarget(true);
    };
    CPDFDoc.prototype.SelectionSetEnd = function(x, y, e) {
        let oDrDoc      = this.GetDrawingDocument();
        let oForm       = this.activeForm;
        let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oTextShape  = this.activeTextShape;

        let oPos    = oDrDoc.ConvertCoordsFromCursor2(x, y);
        let X       = oPos.X;
        let Y       = oPos.Y;

        let oContent;
        if (oForm && oForm.IsInForm() && [AscPDF.FIELD_TYPES.text, AscPDF.FIELD_TYPES.combobox].includes(oForm.GetType())) {
            oForm.SelectionSetEnd(X, Y, e);
            oContent = oForm.GetDocContent();
        }
        else if (oFreeText && oFreeText.IsInTextBox()) {
            oFreeText.SelectionSetEnd(X, Y, e);
            oContent = oFreeText.GetDocContent();
        }
        else if (oTextShape) {
            oTextShape.SelectionSetEnd(X, Y, e);
            oContent = oTextShape.GetDocContent();
        }

        if (oContent) {
            if (oContent.IsSelectionEmpty() == false) {
                oDrDoc.TargetEnd();
            }
            else {
                oDrDoc.TargetStart();
                oDrDoc.showTarget(true);
            }
        }
    };
    CPDFDoc.prototype.SetBold = function(bBold) {
        let oForm       = this.activeForm;
        let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oTextShape  = this.activeTextShape;

        this.CreateNewHistoryPoint({objects: [oFreeText || oTextShape]});
        if (oTextShape) {
            oTextShape.SetBold(bBold);
        }
    };
    CPDFDoc.prototype.SetItalic = function(bBold) {
        let oForm       = this.activeForm;
        let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oTextShape  = this.activeTextShape;

        this.CreateNewHistoryPoint({objects: [oFreeText || oTextShape]});
        if (oTextShape) {
            oTextShape.SetItalic(bBold);
        }
    };
    CPDFDoc.prototype.SetBaseline = function(nType) {
        let oForm       = this.activeForm;
        let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oTextShape  = this.activeTextShape;

        this.CreateNewHistoryPoint({objects: [oFreeText || oTextShape]});
        if (oTextShape) {
            oTextShape.SetBaseline(nType);
        }
    };
    CPDFDoc.prototype.SetHighlight = function(r, g, b, opacity) {
        this.HighlightColor = {
            r: r != undefined ? r : 0,
            g: g != undefined ? g : 0,
            b: b != undefined ? b : 0,
            a: opacity
        };

        let oViewer         = editor.getDocumentRenderer();
        let oFile           = oViewer.file;
        let aSelQuads       = oFile.getSelectionQuads();

        if (this.IsTextEditMode()) {
            let oForm       = this.activeForm;
            let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
            let oTextShape  = this.activeTextShape;

            this.CreateNewHistoryPoint({objects: [oFreeText || oTextShape]});
            if (oTextShape) {
                oTextShape.SetHighlight(r, g, b, opacity);
            }
        }
        else {
            if (aSelQuads.length == 0) {
                return;
            }

            for (let nInfo = 0; nInfo < aSelQuads.length; nInfo++) {
                let nPage   = aSelQuads[nInfo].page;
                let aQuads  = aSelQuads[nInfo].quads;

                let aAllPoints = [];
                aQuads.forEach(function(rect) {
                    aAllPoints = aAllPoints.concat(rect);
                });

                let aMinRect = getMinRect(aAllPoints);
                let MinX = aMinRect[0];
                let MinY = aMinRect[1];
                let MaxX = aMinRect[2];
                let MaxY = aMinRect[3];

                let oProps = {
                    rect:           [MinX - 3, MinY - 1, MaxX + 3, MaxY + 1],
                    page:           nPage,
                    name:           AscCommon.CreateGUID(),
                    type:           AscPDF.ANNOTATIONS_TYPES.Highlight,
                    creationDate:   (new Date().getTime()).toString(),
                    modDate:        (new Date().getTime()).toString(),
                    hidden:         false
                }

                let oAnnot = this.AddAnnot(oProps);

                oAnnot.SetQuads(aQuads);
                oAnnot.SetStrokeColor([r/255, g/255, b/255]);
                oAnnot.SetOpacity(opacity / 100);
            }
        }

        if (this.bOffMarkerAfterUsing) {
            editor.sendEvent("asc_onMarkerFormatChanged", AscPDF.ANNOTATIONS_TYPES.Highlight, false);
            editor.SetMarkerFormat(AscPDF.ANNOTATIONS_TYPES.Highlight, false);
        }
    };
    CPDFDoc.prototype.SetUnderline = function(r, g, b, opacity) {
        this.UnderlineColor = {
            r: r != undefined ? r : 0,
            g: g != undefined ? g : 0,
            b: b != undefined ? b : 0,
            a: opacity
        };

        let oViewer         = editor.getDocumentRenderer();
        let oFile           = oViewer.file;
        let aSelQuads;

        let oForm       = this.activeForm;
        let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oTextShape  = this.activeTextShape;

        if (oTextShape) {
            this.CreateNewHistoryPoint({objects: [oFreeText || oTextShape]});
            if (oTextShape) {
                oTextShape.SetUnderline(r);
            }
        }
        else {
            aSelQuads = oFile.getSelectionQuads();
            if (aSelQuads.length == 0)
                return;

            for (let nInfo = 0; nInfo < aSelQuads.length; nInfo++) {
                let nPage   = aSelQuads[nInfo].page;
                let aQuads  = aSelQuads[nInfo].quads;

                let aAllPoints = [];
                aQuads.forEach(function(rect) {
                    aAllPoints = aAllPoints.concat(rect);
                });

                let aMinRect = getMinRect(aAllPoints);
                let MinX = aMinRect[0];
                let MinY = aMinRect[1];
                let MaxX = aMinRect[2];
                let MaxY = aMinRect[3];

                let oProps = {
                    rect:           [MinX - 3, MinY - 1, MaxX + 3, MaxY + 1],
                    page:           nPage,
                    name:           AscCommon.CreateGUID(),
                    type:           AscPDF.ANNOTATIONS_TYPES.Underline,
                    creationDate:   (new Date().getTime()).toString(),
                    modDate:        (new Date().getTime()).toString(),
                    hidden:         false
                }

                let oAnnot = this.AddAnnot(oProps);

                oAnnot.SetQuads(aQuads);
                oAnnot.SetStrokeColor([r/255, g/255, b/255]);
                oAnnot.SetOpacity(opacity / 100);
            }
        }

        if (this.bOffMarkerAfterUsing) {
            editor.sendEvent("asc_onMarkerFormatChanged", AscPDF.ANNOTATIONS_TYPES.Underline, false);
            editor.SetMarkerFormat(AscPDF.ANNOTATIONS_TYPES.Underline, false);
        }
    };
    CPDFDoc.prototype.SetStrikeout = function(r, g, b, opacity) {
        this.StrikeoutColor = {
            r: r != undefined ? r : 0,
            g: g != undefined ? g : 0,
            b: b != undefined ? b : 0,
            a: opacity
        };

        let oViewer         = editor.getDocumentRenderer();
        let oFile           = oViewer.file;
        let aSelQuads;

        let oForm       = this.activeForm;
        let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oTextShape  = this.activeTextShape;

        if (oTextShape) {
            this.CreateNewHistoryPoint({objects: [oFreeText || oTextShape]});
            if (oTextShape) {
                oTextShape.SetStrikeout(r);
            }
        }
        else {
            aSelQuads = oFile.getSelectionQuads();
            if (aSelQuads.length == 0)
            return;

            for (let nInfo = 0; nInfo < aSelQuads.length; nInfo++) {
                let nPage   = aSelQuads[nInfo].page;
                let aQuads  = aSelQuads[nInfo].quads;

                let aAllPoints = [];
                aQuads.forEach(function(rect) {
                    aAllPoints = aAllPoints.concat(rect);
                });

                let aMinRect = getMinRect(aAllPoints);
                let MinX = aMinRect[0];
                let MinY = aMinRect[1];
                let MaxX = aMinRect[2];
                let MaxY = aMinRect[3];

                let oProps = {
                    rect:           [MinX - 3, MinY - 1, MaxX + 3, MaxY + 1],
                    page:           nPage,
                    name:           AscCommon.CreateGUID(),
                    type:           AscPDF.ANNOTATIONS_TYPES.Strikeout,
                    creationDate:   (new Date().getTime()).toString(),
                    modDate:        (new Date().getTime()).toString(),
                    hidden:         false
                }

                let oAnnot = this.AddAnnot(oProps);

                oAnnot.SetQuads(aQuads);
                oAnnot.SetStrokeColor([r/255, g/255, b/255]);
                oAnnot.SetOpacity(opacity / 100);
            }
        }

        if (this.bOffMarkerAfterUsing) {
            editor.sendEvent("asc_onMarkerFormatChanged", AscPDF.ANNOTATIONS_TYPES.Strikeout, false);
            editor.SetMarkerFormat(AscPDF.ANNOTATIONS_TYPES.Strikeout, false);
        }
    };
    CPDFDoc.prototype.SetFontSize = function(nSize) {
        let oForm       = this.activeForm;
        let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oTextShape  = this.activeTextShape;

        this.CreateNewHistoryPoint({objects: [oFreeText || oTextShape]});
        if (oTextShape) {
            oTextShape.SetFontSize(nSize);
        }
    };
    CPDFDoc.prototype.SetFontFamily = function(sFontFamily) {
        let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oTextShape  = this.activeTextShape;

        this.CreateNewHistoryPoint({objects: [oFreeText || oTextShape]});
        if (oTextShape) {
            oTextShape.SetFontFamily(sFontFamily);
        }
    };
    CPDFDoc.prototype.IncreaseDecreaseFontSize = function(bIncrease) {
        let oForm       = this.activeForm;
        let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oTextShape  = this.activeTextShape;

        this.CreateNewHistoryPoint({objects: [oFreeText || oTextShape]});
        if (oTextShape) {
            oTextShape.IncreaseDecreaseFontSize(bIncrease);
        }
    };
    CPDFDoc.prototype.SetTextColor = function(r, g, b) {
        let oForm       = this.activeForm;
        let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oTextShape  = this.activeTextShape;

        this.CreateNewHistoryPoint({objects: [oFreeText || oTextShape]});
        if (oTextShape) {
            oTextShape.SetTextColor(r, g, b);
        }
    };
    CPDFDoc.prototype.ChangeTextCase = function(nCaseType) {
        let oForm       = this.activeForm;
        let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oTextShape  = this.activeTextShape;

        this.CreateNewHistoryPoint({objects: [oFreeText || oTextShape]});
        if (oTextShape) {
            oTextShape.ChangeTextCase(nCaseType);
        }
    };
    CPDFDoc.prototype.SetAlign = function(nType) {
        let oForm       = this.activeForm;
        let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oTextShape  = this.activeTextShape;

        this.CreateNewHistoryPoint({objects: [oFreeText || oTextShape]});
        if (oTextShape) {
            oTextShape.SetAlign(nType);
        }
    };
    CPDFDoc.prototype.SetVertAlign = function(nType) {
        let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oTextShape  = this.activeTextShape;

        this.CreateNewHistoryPoint({objects: [oFreeText || oTextShape]});
        if (oTextShape) {
            oTextShape.SetVertAlign(nType);
        }
    };
    CPDFDoc.prototype.SetLineSpacing = function(oSpacing) {
        let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oTextShape  = this.activeTextShape;

        this.CreateNewHistoryPoint({objects: [oFreeText || oTextShape]});
        if (oTextShape) {
            oTextShape.SetLineSpacing(oSpacing);
        }
    };
    CPDFDoc.prototype.GetMarkerColor = function(nType) {
        switch (nType) {
            case AscPDF.ANNOTATIONS_TYPES.Highlight:
                return this.HighlightColor;
            case AscPDF.ANNOTATIONS_TYPES.Underline:
                return this.UnderlineColor;
            case AscPDF.ANNOTATIONS_TYPES.Strikeout:
                return this.StrikeoutColor;
        }

        return null;
    };
    CPDFDoc.prototype.IncreaseDecreaseIndent = function(bIncrease) {
        let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oTextShape  = this.activeTextShape;

        this.CreateNewHistoryPoint({objects: [oFreeText || oTextShape]});
        if (oTextShape) {
            oTextShape.IncreaseDecreaseIndent(bIncrease);
        }
    };
    CPDFDoc.prototype.SetNumbering = function(oBullet) {
        let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oTextShape  = this.activeTextShape;

        this.CreateNewHistoryPoint({objects: [oFreeText || oTextShape]});
        if (oTextShape) {
            oTextShape.SetNumbering(oBullet);
        }
    };
    CPDFDoc.prototype.ClearFormatting = function(bParaPr, bTextText) {
        let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oTextShape  = this.activeTextShape;

        this.CreateNewHistoryPoint({objects: [oFreeText || oTextShape]});
        if (oTextShape) {
            oTextShape.ClearFormatting(bParaPr, bTextText);
        }
    };

    
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	// For text shapes
	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    CPDFDoc.prototype.ShapeApply = function(shapeProps) {
        let oDrawingObjects = this.Viewer.DrawingObjects;
        let aSelected       = oDrawingObjects.getSelectedObjectsByTypes(true);

        this.CreateNewHistoryPoint();
        for (let i = 0; i < aSelected.shapes.length; i++) {
            let oShape = aSelected.shapes[i];

            if (AscFormat.isRealNumber(shapeProps.columnNumber)) {
                oShape.SetColumnNumber(shapeProps.columnNumber);
            }
        }
    };
    CPDFDoc.prototype.InitDefaultTextListStyles = function() {
        let oTextStyles     = new AscFormat.CTextStyles();
        let oTextListStyle  = new AscFormat.TextListStyle();

        oTextStyles.otherStyle = oTextListStyle;

        let nDefTab     = 25.4
        let nIndStep    = 12.7;
        let nJc         = AscCommon.align_Left;

        for (let i = 0; i < 10; i++) {
            let oParaPr = new AscWord.CParaPr();
            oTextListStyle.levels[i] = oParaPr;

            if (i == 9)
                break;

            oParaPr.DefaultTab  = nDefTab;
            oParaPr.Ind.Left    = i * nIndStep;
            oParaPr.Jc          = nJc;
        }

        this.styles.txStyles = oTextStyles;
    };

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	// Extension required for History
	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    CPDFDoc.prototype.IsViewModeInReview = function() {
        return false;
    };
    CPDFDoc.prototype.Is_OnRecalculate = function() {
        return false;
    };
	CPDFDoc.prototype.IsActionStarted = function() {
		return false;
	};
    CPDFDoc.prototype.GetSelectionState = function() {
        return null;
    };
    CPDFDoc.prototype.SetSelectionState = function(oState) {
        return;
    };
    CPDFDoc.prototype.RemoveSelection = function() {};
    
    CPDFDoc.prototype.GetDocPosType = function() {};
    

	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	// Extension required for CTextBoxContent
	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	CPDFDoc.prototype.IsTrackRevisions = function() {
		return false;
	};
	CPDFDoc.prototype.IsDocumentEditor = function() {
		return false;
	};
	CPDFDoc.prototype.IsPresentationEditor = function() {
		return false;
	};
	CPDFDoc.prototype.IsSpreadSheetEditor = function() {
		return false;
	};
	CPDFDoc.prototype.IsPdfEditor = function() {
		return true;
	};
	CPDFDoc.prototype.Get_Styles = function() {
		return this.styles;
	};
	CPDFDoc.prototype.GetStyles = function() {
		return this.Get_Styles();
	};

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	// Extension required for CGraphicObjects
	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    CPDFDoc.prototype.Get_ColorMap = function() {
        return this.clrSchemeMap;
    };
    /**
     * Запрашиваем настройку автозамены двух дефисов на тире
     * @returns {boolean}
     */
    CPDFDoc.prototype.IsAutoCorrectHyphensWithDash = function()
    {
        return this.AutoCorrectSettings.IsHyphensWithDash();
    };
    CPDFDoc.prototype.GetHistory = function() {
        return AscCommon.History;
    };
	CPDFDoc.prototype.Get_Numbering = function() {
		return AscWord.DEFAULT_NUMBERING;
	};
	CPDFDoc.prototype.GetNumbering = function() {
		return this.Get_Numbering();
	};
	CPDFDoc.prototype.IsDoNotExpandShiftReturn = function() {
		return false;
	};
	CPDFDoc.prototype.GetCompatibilityMode = function() {
		return AscCommon.document_compatibility_mode_Word12;
	};
	CPDFDoc.prototype.Get_PageLimits = function(pageIndex) {
		let documentRenderer = this.GetDocumentRenderer();
		return documentRenderer.Get_PageLimits(pageIndex);
	};
	CPDFDoc.prototype.Get_PageFields = function(pageIndex) {
		return this.Get_PageLimits(pageIndex);
	};
	CPDFDoc.prototype.GetApi = function() {
		return editor;
	};
	CPDFDoc.prototype.CanEdit = function() {
		return true;
	};
	CPDFDoc.prototype.IsFillingFormMode = function() {
		return false;
	};
	CPDFDoc.prototype.getDrawingObjects = function() {
		if (!this.Viewer)
			return null;
		
		return this.Viewer.DrawingObjects;
	};
	CPDFDoc.prototype.checkDefaultFieldFonts = function(callback) {
		
		if (1 === this.defaultFontsLoaded)
			return true;
		
		if (callback)
			this.fontLoaderCallbacks.push(callback);

		if (0 === this.defaultFontsLoaded)
			return false;
		
		this.defaultFontsLoaded = 0;
		let _t = this;
		this.fontLoader.LoadDocumentFonts2([{name : AscPDF.DEFAULT_FIELD_FONT}],
			Asc.c_oAscAsyncActionType.Empty,
			function()
			{
				_t.defaultFontsLoaded = 1;
				_t.fontLoaderCallbacks.forEach(function(callback) {
					callback();
				});
				
				_t.fontLoaderCallbacks = [];
			}
		);

		return 1 === this.defaultFontsLoaded;
	};
    CPDFDoc.prototype.checkFieldFont = function(oField, callback) {
        if (!oField)
            return true;
        
        // при клике по кнопке внешний вид остается прежним, поэтому грузить шрифт не надо
        if (oField.GetType() == AscPDF.FIELD_TYPES.button && oField.IsNeedDrawFromStream())
            return true;

		let sFontName = oField.GetTextFontActual();

        if (!sFontName)
            return true;
        
		if (this.loadedFonts.includes(sFontName))
            return true;
		
		if (callback)
			this.fontLoaderCallbacks.push(callback);

		let _t = this;
		this.fontLoader.LoadDocumentFonts2([{name : sFontName}],
			Asc.c_oAscAsyncActionType.Empty,
			function()
			{
				_t.loadedFonts.push(sFontName);
				_t.fontLoaderCallbacks.forEach(function(callback) {
					callback();
				});
				
				_t.fontLoaderCallbacks = [];
			}
		);

		return false;
	};
    CPDFDoc.prototype.checkFonts = function(aFontsNames, callback) {
        let aFontsToLoad    = [];
        let aMap            = [];

        for (let i = 0; i < aFontsNames.length; i++) {
            if (this.loadedFonts.includes(aFontsNames[i]) == false && aFontsToLoad.includes(aFontsNames[i]) == false) {
                aFontsToLoad.push(aFontsNames[i]);
                aMap.push({name: aFontsNames[i]});
            }
        }

        if (aMap.length == 0) {
            return true;
        }

        if (callback)
			this.fontLoaderCallbacks.push(callback);

        let _t = this;
        this.fontLoader.LoadDocumentFonts2(aMap,
			Asc.c_oAscAsyncActionType.Empty,
			function()
			{
				_t.loadedFonts = _t.loadedFonts.concat(aFontsToLoad);
				_t.fontLoaderCallbacks.forEach(function(callback) {
					callback();
				});
				
				_t.fontLoaderCallbacks = [];
			}
		);

        return false;
    };
	
    function CActionQueue(oDoc) {
        this.doc                = oDoc;
        this.actions            = [];
        this.isInProgress       = false;
        this.curAction          = null;
        this.curActionIdx       = -1;
        this.callbackAfterFocus = null;
    };

    CActionQueue.prototype.AddActions = function(aActions) {
        this.actions = this.actions.concat(aActions);
    };
    CActionQueue.prototype.SetCurAction = function(oAction) {
        this.curAction = oAction;
    };
    CActionQueue.prototype.GetNextAction = function() {
        return this.actions[this.curActionIdx + 1];
    };
    CActionQueue.prototype.Clear = function() {
        this.actions = [];
        this.curActionIdx = -1;
        this.curAction = null;
        this.callbackAfterFocus = null;
    };
    CActionQueue.prototype.Stop = function() {
        this.SetInProgress(false);
    };
    CActionQueue.prototype.IsInProgress = function() {
        return this.isInProgress;
    };
    CActionQueue.prototype.SetInProgress = function(bValue) {
        this.isInProgress = bValue;
    };
    CActionQueue.prototype.SetCurActionIdx = function(nValue) {
        this.curActionIdx = nValue;
    };
    CActionQueue.prototype.Start = function() {
        if (this.IsInProgress() == false) {
            let oFirstAction = this.actions[0];
            if (oFirstAction) {
                this.SetInProgress(true);
                this.SetCurActionIdx(0);
                setTimeout(function() {
                    oFirstAction.Do();
                }, 100);
            }
        }
    };
    CActionQueue.prototype.Continue = function() {
        let oNextAction = this.GetNextAction();
        if (this.callbackAfterFocus && this.curAction.triggerType == AscPDF.FORMS_TRIGGERS_TYPES.OnFocus && (!oNextAction || oNextAction.triggerType != AscPDF.FORMS_TRIGGERS_TYPES.OnFocus))
            this.callbackAfterFocus();

        if (oNextAction && this.IsInProgress()) {
            this.curActionIdx += 1;
            oNextAction.Do();
        }
        else {
            this.Stop();
            this.doc.OnEndFormsActions();
            this.Clear();
        }
    };

    function private_createField(cName, cFieldType, nPageNum, oCoords, oPdfDoc) {
        let oField;
        switch (cFieldType) {
            case AscPDF.FIELD_TYPES.button:
                oField = new AscPDF.CPushButtonField(cName, nPageNum, oCoords, oPdfDoc);
                break;
            case AscPDF.FIELD_TYPES.checkbox:
                oField = new AscPDF.CCheckBoxField(cName, nPageNum, oCoords, oPdfDoc);
                break;
            case AscPDF.FIELD_TYPES.combobox:
                oField = new AscPDF.CComboBoxField(cName, nPageNum, oCoords, oPdfDoc);
                break;
            case AscPDF.FIELD_TYPES.listbox:
                oField = new AscPDF.CListBoxField(cName, nPageNum, oCoords, oPdfDoc);
                break;
            case AscPDF.FIELD_TYPES.radiobutton:
                oField = new AscPDF.CRadioButtonField(cName, nPageNum, oCoords, oPdfDoc);
                break;
            case AscPDF.FIELD_TYPES.signature:
                oField = new AscPDF.CSignatureField(cName, nPageNum, oCoords, oPdfDoc);;
                break;
            case AscPDF.FIELD_TYPES.text:
                oField = new AscPDF.CTextField(cName, nPageNum, oCoords, oPdfDoc);
                break;
            case AscPDF.FIELD_TYPES.unknown: 
                oField = new AscPDF.CBaseField(cName, nPageNum, oCoords, oPdfDoc);
                break;
        }

        return oField;
    }

    function CreateAnnotByProps(oProps, oPdfDoc) {
        let aRect       = oProps.rect;
        let nPageNum    = oProps.page;
        let sName       = oProps.name ? oProps.name : AscCommon.CreateGUID();
        let nAnnotType  = oProps.type;
        let sAuthor     = oProps.author ? oProps.author : AscCommon.UserInfoParser.getCurrentName();
        let sCrDate     = oProps.creationDate;
        let sModDate    = oProps.modDate;
        let sText       = oProps.contents;
        let isHidden    = !!oProps.hidden;
        
        let oAnnot;

        let oViewer = editor.getDocumentRenderer();
        let nScaleY = oViewer.drawingPages[nPageNum].H / oViewer.file.pages[nPageNum].H / oViewer.zoom;
        let nScaleX = oViewer.drawingPages[nPageNum].W / oViewer.file.pages[nPageNum].W / oViewer.zoom;

        let aScaledCoords = [aRect[0] * nScaleX, aRect[1] * nScaleY, aRect[2] * nScaleX, aRect[3] * nScaleY];
        switch (nAnnotType) {
            case AscPDF.ANNOTATIONS_TYPES.Text:
                oAnnot = new AscPDF.CAnnotationText(sName, nPageNum, aRect, oPdfDoc);
                break;
            case AscPDF.ANNOTATIONS_TYPES.Ink:
                oAnnot = new AscPDF.CAnnotationInk(sName, nPageNum, aRect, oPdfDoc);
                break;
            case AscPDF.ANNOTATIONS_TYPES.Highlight:
                oAnnot = new AscPDF.CAnnotationHighlight(sName, nPageNum, aRect, oPdfDoc);
                break;
            case AscPDF.ANNOTATIONS_TYPES.Underline:
                oAnnot = new AscPDF.CAnnotationUnderline(sName, nPageNum, aRect, oPdfDoc);
                break;
            case AscPDF.ANNOTATIONS_TYPES.Strikeout:
                oAnnot = new AscPDF.CAnnotationStrikeout(sName, nPageNum, aRect, oPdfDoc);
                break;
            case AscPDF.ANNOTATIONS_TYPES.Squiggly:
                oAnnot = new AscPDF.CAnnotationSquiggly(sName, nPageNum, aRect, oPdfDoc);
                break;
            case AscPDF.ANNOTATIONS_TYPES.Caret:
                oAnnot = new AscPDF.CAnnotationCaret(sName, nPageNum, aRect, oPdfDoc);
                oAnnot.SetQuads([[aRect[0], aRect[1], aRect[2], aRect[1], aRect[0], aRect[3], aRect[2], aRect[3]]]);
                break;
            case AscPDF.ANNOTATIONS_TYPES.Line:
                oAnnot = new AscPDF.CAnnotationLine(sName, nPageNum, aRect, oPdfDoc);
                break;
            case AscPDF.ANNOTATIONS_TYPES.Square:
                oAnnot = new AscPDF.CAnnotationSquare(sName, nPageNum, aRect, oPdfDoc);
                break;
            case AscPDF.ANNOTATIONS_TYPES.Circle:
                oAnnot = new AscPDF.CAnnotationCircle(sName, nPageNum, aRect, oPdfDoc);
                break;
            case AscPDF.ANNOTATIONS_TYPES.Polygon:
                oAnnot = new AscPDF.CAnnotationPolygon(sName, nPageNum, aRect, oPdfDoc);
                break;
            case AscPDF.ANNOTATIONS_TYPES.PolyLine:
                oAnnot = new AscPDF.CAnnotationPolyLine(sName, nPageNum, aRect, oPdfDoc);
                break;
            case AscPDF.ANNOTATIONS_TYPES.FreeText:
                oAnnot = new AscPDF.CAnnotationFreeText(sName, nPageNum, aRect, oPdfDoc);
                break;
            default:
                return null;
        }

        oAnnot.SetCreationDate(sCrDate);
        oAnnot.SetModDate(sModDate);
        oAnnot.SetAuthor(sAuthor);
        oAnnot.SetDisplay(isHidden ? window["AscPDF"].Api.Objects.display["hidden"] : window["AscPDF"].Api.Objects.display["visible"]);
        oAnnot.SetContents(sText);

        oAnnot._pagePos = {
            x: aScaledCoords[0],
            y: aScaledCoords[1],
            w: (aScaledCoords[2] - aScaledCoords[0]),
            h: (aScaledCoords[3] - aScaledCoords[1])
        };

        return oAnnot;
    }

    function private_PtToMM(pt)
	{
		return 25.4 / 72.0 * pt;
	}

    function getMinRect(aPoints) {
        let xMax = aPoints[0], yMax = aPoints[1], xMin = xMax, yMin = yMax;
        for(let i = 1; i < aPoints.length; i++) {
            if (i % 2 == 0) {
                if(aPoints[i] < xMin)
                {
                    xMin = aPoints[i];
                }
                if(aPoints[i] > xMax)
                {
                    xMax = aPoints[i];
                }
            }
            else {
                if(aPoints[i] < yMin)
                {
                    yMin = aPoints[i];
                }

                if(aPoints[i] > yMax)
                {
                    yMax = aPoints[i];
                }
            }
        }

        return [xMin, yMin, xMax, yMax];
    }

    if (!window["AscPDF"])
	    window["AscPDF"] = {};

    window["AscPDF"].CPDFDoc = CPDFDoc;
    window["AscPDF"].CreateAnnotByProps = CreateAnnotByProps;

})();

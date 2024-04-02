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
        this.drawings   = []; // из презентаций (чарты, шейпы, картинки)

        this.widgetsParents = []; // все родительские поля

        this.maxApIdx               = -1;
        this.MathTrackHandler       = new AscWord.CMathTrackHandler(this.GetDrawingDocument(), Asc.editor);
        this.TextPrTrackHandler     = new AscPDF.CTextPrTrackHandler(this.GetDrawingDocument(), Asc.editor);
        this.theme                  = AscFormat.GenerateDefaultTheme(this);
        this.clrSchemeMap           = AscFormat.GenerateDefaultColorMap();
        this.styles                 = AscCommonWord.DEFAULT_STYLES.Copy();
        this.TableStylesIdMap       = {};
        this.InitDefaultTextListStyles();
        this.InitDefaultTableStyles();
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
        this.activeDrawing    = null;
        this.mouseDownField     = null;
        this.mouseDownAnnot     = null;

        this.editMode = {
            text: false,
            forms: false
        }

        this._id = AscCommon.g_oIdCounter.Get_NewId();
		
		this.History        = new AscPDF.History(this);
		this.LocalHistory   = new AscPDF.History(this);
        
		AscCommon.History = this.History;
		
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

        let oController                 = this.GetController();
        let oDrDoc                      = this.GetDrawingDocument();
        oDrDoc.UpdateTargetFromPaint    = true

        let IsOnDrawer      = this.Api.isDrawInkMode();
        let IsOnEraser      = this.Api.isEraseInkMode();
        let IsOnAddAddShape = this.Api.isStartAddShape;

        let oMouseDownLink      = oViewer.getPageLinkByMouse();
        let oMouseDownField     = oViewer.getPageFieldByMouse();
        let oMouseDownAnnot     = oViewer.getPageAnnotByMouse();
        let oMouseDownDrawing   = oViewer.getPageDrawingByMouse();

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
            oController.startAddShape(this.Api.addShapePreset);
            oController.OnMouseDown(e, X, Y, oPos.DrawPage);
            return;
        }
        // если рисование
        else if (IsOnDrawer == true || oViewer.Api.isMarkerFormat) {
            oController.OnMouseDown(e, X, Y, oPos.DrawPage);
            return;
        }
        
        let oCurObject = this.GetMouseDownObject();
        // оставляем текущий объет к селекте, если кликнули по нему же
        if (null == oCurObject || (oCurObject && false == [oMouseDownField, oMouseDownAnnot, oMouseDownDrawing, oMouseDownLink].includes(oCurObject)))
            this.SetMouseDownObject(oMouseDownField || oMouseDownAnnot || oMouseDownDrawing || oMouseDownLink);

        let oMouseDownObject = this.GetMouseDownObject();
        if (oMouseDownObject) {

            // если форма, то проверяем шрифт перед кликом в неё
            if (oMouseDownObject.IsForm() && false == [AscPDF.FIELD_TYPES.signature, AscPDF.FIELD_TYPES.checkbox , AscPDF.FIELD_TYPES.radiobutton].includes(oMouseDownObject.GetType())) {
                let _t = this;
                if (!this.checkFieldFont(oMouseDownObject, function() {
                    _t.SetMouseDownObject(null);
                    _t.OnMouseDown(x, y, e)
                })) {
                    return;
                }

                if ((oMouseDownObject.IsNeedDrawFromStream() || oMouseDownObject.IsNeedRecalc()) && oMouseDownObject.GetType() != AscPDF.FIELD_TYPES.button) {
                    oMouseDownObject.Recalculate();
                    oMouseDownObject.SetNeedRecalc(true);
                }
            }

            // всегда даём кликнуть по лкм, пкм даем кликнуть один раз, при первом попадании в объект
            if (AscCommon.getMouseButton(e || {}) != 2 || (AscCommon.getMouseButton(e || {}) == 2 && oCurObject != oMouseDownObject)) {
                oMouseDownObject.onMouseDown(x, y, e);
            }
            

            if (((oMouseDownObject.IsDrawing() && oMouseDownObject.IsTextShape()) || (oMouseDownObject.IsAnnot() && oMouseDownObject.IsFreeText())) && false == oMouseDownObject.IsInTextBox()) {
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
        if (oMouseDownObject == null || (false == oController.selectedObjects.includes(oMouseDownObject) && oController.selection.groupSelection != oMouseDownObject)) {
            oController.resetSelection();
            oController.resetTrackState();
        }

        this.UpdateInterface();
    };
    CPDFDoc.prototype.BlurActiveObject = function() {
        let oActiveObj = this.GetActiveObject();

        if (!oActiveObj)
            return;
        
        let oDrDoc      = this.GetDrawingDocument();
        let oController = this.GetController();

        let oContent;
        if (oActiveObj.IsDrawing()) {
            oContent = oActiveObj.GetDocContent();

            oController.resetSelection();
            oController.resetTrackState();
            if (oActiveObj.IsImage() == false) {
                oActiveObj.SetInTextBox(false);
            }

            this.activeDrawing = null;
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
            this.activeDrawing        = null;
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
            this.activeDrawing        = null;
            this.mouseDownLinkObject    = null;
        }
        else if (oObject.IsAnnot && oObject.IsAnnot()) {
            if (oObject != this.mouseDownAnnot) {
                this.BlurActiveObject();
            }

            this.mouseDownField         = null;
            this.mouseDownAnnot         = oObject;
            this.activeDrawing        = null;
            this.mouseDownLinkObject    = null;
        }
        else if (oObject.IsDrawing && oObject.IsDrawing()) {
            if (oObject != this.activeDrawing) {
                this.BlurActiveObject();
            }

            this.mouseDownField         = null;
            this.mouseDownAnnot         = null;
            this.activeDrawing        = oObject;
            this.mouseDownLinkObject    = null;
        }
        // значит Link object
        else {
            this.mouseDownField         = null;
            this.mouseDownAnnot         = null;
            this.activeDrawing        = null;
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
        let oViewer = editor.getDocumentRenderer();
        if (!oViewer.canInteract()) {
            return;
        }

        let oController     = this.GetController();
        let oDrDoc          = this.GetDrawingDocument();
        
        let IsOnDrawer      = this.Api.isDrawInkMode();
        let IsOnEraser      = this.Api.isEraseInkMode();
        let IsOnAddAddShape = this.Api.isStartAddShape;

        let oMouseMoveLink          = oViewer.getPageLinkByMouse();
        let oMouseMoveField         = oViewer.getPageFieldByMouse();
        let oMouseMoveAnnot         = oViewer.getPageAnnotByMouse();
        let oMouseMoveDrawing       = oViewer.getPageDrawingByMouse();

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
                oController.OnMouseMove(e, X, Y, oPos.DrawPage);
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

                oController.OnMouseMove(e, X, Y, oPos.DrawPage);
            }
            else if (this.activeDrawing) {
                oController.OnMouseMove(e, X, Y, oPos.DrawPage);
                // если тянем за бордер, то не обновляем оверлей, т.к. рисуется внутри oController.OnMouseMove(e, X, Y, oPos.DrawPage);
                if (this.activeDrawing.IsGraphicFrame() && this.activeDrawing.graphicObject.Selection.Type2 === table_Selection_Border) {
                    return;
                }
            }

            oViewer.onUpdateOverlay();
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

        this.UpdateCursorType(x, y, e);
    };
    CPDFDoc.prototype.UpdateCursorType = function(x, y, e) {
        let oViewer         = editor.getDocumentRenderer();
        let oController     = this.GetController();
        let oDrDoc          = this.GetDrawingDocument();
        
        let IsOnDrawer      = this.Api.isDrawInkMode();
        let IsOnEraser      = this.Api.isEraseInkMode();
        let IsOnAddAddShape = this.Api.isStartAddShape;

        let oMouseMoveLink          = oViewer.getPageLinkByMouse();
        let oMouseMoveField         = oViewer.getPageFieldByMouse();
        let oMouseMoveAnnot         = oViewer.getPageAnnotByMouse();
        let oMouseMoveDrawing       = oViewer.getPageDrawingByMouse();

        // координаты клика на странице в MM
        let oPos    = oDrDoc.ConvertCoordsFromCursor2(x, y);
        let X       = oPos.X;
        let Y       = oPos.Y;

        let isCursorUpdated = oController.updateCursorType(oPos.DrawPage, X, Y, e, false);
        let oCursorInfo     = oController.getGraphicInfoUnderCursor(oPos.DrawPage, X, Y);
        let oCurObject      = this.GetActiveObject();

        // уже обновлён в oController
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
        
        let oController     = this.GetController();
        let oDrDoc          = this.GetDrawingDocument();
        
        let IsOnDrawer      = this.Api.isDrawInkMode();
        let IsOnEraser      = this.Api.isEraseInkMode();
        let IsOnAddAddShape = this.Api.isStartAddShape;

        let oMouseUpLink        = oViewer.getPageLinkByMouse();
        let oMouseUpField       = oViewer.getPageFieldByMouse();
        let oMouseUpAnnot       = oViewer.getPageAnnotByMouse();
        let oMouseUpDrawing   = oViewer.getPageDrawingByMouse();

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
            oController.OnMouseUp(e, X, Y, oPos.DrawPage);
            return;
        }

        if (this.mouseDownField && oMouseUpField == this.mouseDownField) {
            this.OnMouseUpField(oMouseUpField, e);
        }
        else if (this.mouseDownAnnot) {
            oController.OnMouseUp(e, X, Y, oPos.DrawPage);
            if (this.mouseDownAnnot == oMouseUpAnnot)
                oMouseUpAnnot.onMouseUp(x, y, e);
        }
        else if (this.activeDrawing) {
            // передвинули бордер
            if (this.activeDrawing.IsGraphicFrame() && this.activeDrawing.graphicObject.Selection.Type2 === table_Selection_Border) {
                this.CreateNewHistoryPoint({objects: [this.activeDrawing]});
                this.activeDrawing.SetNeedRecalc(true);
            }

            oController.OnMouseUp(e, X, Y, oPos.DrawPage);
            oController.updateCursorType(oPos.DrawPage, X, Y, e, false);
            this.TurnOffHistory();
        }
        else if (this.mouseDownLinkObject && this.mouseDownLinkObject == oMouseUpLink) {
            oViewer.navigateToLink(oMouseUpLink);
        }
        
        e.IsLocked = false;

        oDrDoc.UnlockCursorType();
        
        this.UpdateInterface();
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
        oDrDoc.UpdateTargetFromPaint = true;

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
            let oTextConvert    = oCurPoint.Additional.PdfConvertText;

            if (oTextConvert) {
                this.Viewer.drawingPages[oTextConvert.page].isConvertedToShapes = false;
                this.isUndoRedoInProgress = false;
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
                else if (oSourceObj.IsAnnot() || oSourceObj.IsDrawing()) {
                    oSourceObj.SetNeedRecalc(true);
                }
            }
            
            this.isUndoRedoInProgress = false;
        }
    };
    CPDFDoc.prototype.DoRedo = function() {
        let oDrDoc = this.GetDrawingDocument();
        oDrDoc.UpdateTargetFromPaint = true;

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
            let oTextConvert    = oCurPoint.Additional.PdfConvertText;

            if (oTextConvert) {
                this.Viewer.drawingPages[oTextConvert.page].isConvertedToShapes = true;
                this.isUndoRedoInProgress = false;
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
                else if (oSourceObj.IsAnnot() || oSourceObj.IsDrawing()) {
                    oSourceObj.SetNeedRecalc(true);
                }
            }

            this.isUndoRedoInProgress = false;
        }
    };
    CPDFDoc.prototype.SetNeedUpdateTarget = function(bUpdate) {
        this.NeedUpdateTarget = bUpdate;
    };
    
    /**
	 * Получает активный объект
	 */
    CPDFDoc.prototype.GetActiveObject = function() {
        return this.activeForm || this.mouseDownAnnot || this.activeDrawing;
    };
    /**
	 * Разница от предыдущего метода в том, что для полей будет полочено поле, в которое был клик, а не активное
     * так как после клика в поле, оно может перестать быть активный после выполнения каких либо actions
	 */
    CPDFDoc.prototype.GetMouseDownObject = function() {
        return this.mouseDownField || this.mouseDownAnnot || this.activeDrawing;
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
        let oViewer     = editor.getDocumentRenderer();
        let oFile       = oViewer.file;
        let oController = this.GetController();

        if (nPos === undefined || -1 === nPos)
            nPos = oFile.pages.length;
        if (nWidth === undefined)
            nWidth = oFile.pages[nPos - 1].W;
        if (nHeight === undefined)
            nHeight = oFile.pages[nPos - 1].H;

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
        for (let i = 0; i < oViewer.file.pages.length; i++) {
            oController.mergeDrawings(i);
        }
        this.GetDrawingDocument().m_lPagesCount = oViewer.file.pages.length;

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

        if (!AscCommon.History.IsOn())
            AscCommon.History.TurnOn();
        
        AscCommon.History.Create_NewPoint();

        if (oAdditional) {
            if (oAdditional.textConvert) {
                AscCommon.History.SetPdfConvertTextPoint(oAdditional.textConvert);
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
        oDrDoc.UpdateTargetFromPaint = true;

        let oForm       = this.activeForm;
        let oAnnot      = this.mouseDownAnnot;
        let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oDrawing    = this.activeDrawing;

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
        else if (oDrawing) {
            if (oDrawing.IsInTextBox()) {
                oDrawing.Remove(nDirection, isCtrlKey);
                oContent = oDrawing.GetDocContent();
            }
            else {
                this.RemoveDrawing(oDrawing.GetId());
            }
        }
        else if (nDirection == 1 && oAnnot && this.Viewer.isMouseDown == false) {
            this.RemoveAnnot(oAnnot.GetId());
        }

        if (oContent) {
            oDrDoc.TargetStart();
            oDrDoc.showTarget(true);
        }
        else {
            oDrDoc.TargetEnd();
        }
    };
    CPDFDoc.prototype.EnterDown = function(isShiftKey) {
        let oDrDoc      = this.GetDrawingDocument();
        
        let oForm       = this.activeForm;
        let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oDrawing  = this.activeDrawing;

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
            this.AddNewParagraph();
            oContent = oFreeText.GetDocContent();
        }
        else if (oDrawing) {
            this.AddNewParagraph();
            oContent = oDrawing.GetDocContent();
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
        let oViewer     = editor.getDocumentRenderer();
        let oController = this.GetController();

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
        oController.resetSelection();
        oController.resetTrackState();
    };

    CPDFDoc.prototype.RemoveDrawing = function(Id) {
        let oViewer     = editor.getDocumentRenderer();
        let oController = this.GetController();

        let oDrawing  = this.drawings.find(function(annot) {
            return annot.GetId() === Id;
        });

        if (!oDrawing)
            return;

        let nPage = oDrawing.GetPage();
        oDrawing.AddToRedraw();

        let nPos        = this.drawings.indexOf(oDrawing);
        let nPosInPage  = oViewer.pagesInfo.pages[nPage].drawings.indexOf(oDrawing);

        this.drawings.splice(nPos, 1);
        oViewer.pagesInfo.pages[nPage].drawings.splice(nPosInPage, 1);
        
        if (this.mouseDownAnnot == oDrawing)
            this.mouseDownAnnot = null;

        this.CreateNewHistoryPoint();
        this.History.Add(new CChangesPDFDocumentRemoveItem(this, [nPos, nPosInPage], [oDrawing]));
        this.TurnOffHistory();

        oController.resetSelection();
        oController.resetTrackState();

        if (this.activeDrawing == oDrawing) {
            this.activeDrawing = null;
        }
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
    CPDFDoc.prototype.GetDrawingById = function(sId) {
        if (!sId) {
            return null;
        }

        function findInDrawing(drawing) {
            let isFound = false;
            if (drawing.GetId() == sId) {
                isFound = true;
                return isFound;
            }

            if (drawing.isGroup()) {
                isFound = drawing.spTree.find(findInDrawing)
            }

            return isFound;
        };

        let oDrawing = this.drawings.find(function(drawing) {
            return findInDrawing(drawing);
        });

        return oDrawing;
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
        let oController = this.GetController();

        this.annots.forEach(function(annot) {
            annot.SetDisplay(bHidden ? window["AscPDF"].Api.Objects.display["hidden"] : window["AscPDF"].Api.Objects.display["visible"]);
            annot.AddToRedraw();
        });

        this.annotsHidden = bHidden;

        this.HideComments();
        this.mouseDownAnnot = null;
        oController.resetSelection();
        oController.resetTrackState();
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
        this.Api.sync_BeginCatchSelectedElements();

        let oDrDoc      = this.GetDrawingDocument();
        let oController = this.GetController();
        let oDrawingPr  = oController.getDrawingProps();
        let oCurObject  = this.GetActiveObject();

        if (oCurObject) {
            if (oCurObject.IsDrawing()) {
                let oImgPr      = oDrawingPr.imageProps;
                let oSpPr       = oDrawingPr.shapeProps;
                let oChartPr    = oDrawingPr.chartProps;
                let oTblPr      = oDrawingPr.tableProps;
                let oParaPr     = oController.getParagraphParaPr();
                let oTextPr     = oController.getParagraphTextPr()

                if (oImgPr) {
                    oImgPr.Width = oImgPr.w;
                    oImgPr.Height = oImgPr.h;
                    oImgPr.Position = {X: oImgPr.x, Y: oImgPr.y};
                    if (AscFormat.isRealBool(oImgPr.locked) && oImgPr.locked) {
                        oImgPr.Locked = true;
                    }
                    this.Api.sync_ImgPropCallback(oImgPr);
                }
                if (oSpPr) {
                    oSpPr.Position = new Asc.CPosition({X: oSpPr.x, Y: oSpPr.y});
                    this.Api.sync_shapePropCallback(oSpPr);
                    this.Api.sync_VerticalTextAlign(oSpPr.verticalTextAlign);
                    this.Api.sync_Vert(oSpPr.vert);
                }
                if (oTblPr) {
                    oDrDoc.CheckTableStyles(oTblPr.TableLook);
                    this.Api.sync_TblPropCallback(oTblPr);
                    if (!oSpPr) {
                        if (oTblPr.CellsVAlign === vertalignjc_Bottom) {
                            this.Api.sync_VerticalTextAlign(AscFormat.VERTICAL_ANCHOR_TYPE_BOTTOM);
                        } else if (oTblPr.CellsVAlign === vertalignjc_Center) {
                            this.Api.sync_VerticalTextAlign(AscFormat.VERTICAL_ANCHOR_TYPE_CENTER);
                        } else {
                            this.Api.sync_VerticalTextAlign(AscFormat.VERTICAL_ANCHOR_TYPE_TOP);
                        }
                    }
                }
            }
            else if (oCurObject.IsAnnot()) {
                this.Api.sync_annotPropCallback(oCurObject);
            }
        }
        
        this.UpdateUndoRedo();
        this.UpdateCommentPos();
        this.UpdateCopyCutState();
        this.UpdateParagraphProps();
        this.UpdateTextProps();
        this.UpdateCanAddHyperlinkState();
        this.Api.sync_EndCatchSelectedElements();
        
        Asc.editor.CheckChangedDocument();
    };
    CPDFDoc.prototype.UpdateCanAddHyperlinkState = function() {
        this.Api.sync_CanAddHyperlinkCallback(this.CanAddHyperlink(false));
    };
    CPDFDoc.prototype.CanAddHyperlink = function(bCheckInHyperlink) {
        let oController = this.GetController();
        return oController.hyperlinkCanAdd(bCheckInHyperlink);
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
        let oActiveDrawing  = this.activeDrawing;

        let isCanCopy = false;
        let isCanCut = false;

        let oSelection = oViewer.file.Selection;
        if (oSelection.Glyph1 != oSelection.Glyph2 || oSelection.Line1 != oSelection.Line2 || oSelection.Page1 != oSelection.Page2) {
            isCanCopy = true;
        }
        
        let oContent;
        if (oActiveForm) {
            oContent = oActiveForm.GetDocContent();
        }
        else if (oActiveAnnot && oActiveAnnot.IsFreeText() && oActiveAnnot.IsInTextBox()) {
            oContent = oActiveAnnot.GetDocContent();
        }
        else if (oActiveDrawing) {
            oContent = oActiveDrawing.GetDocContent();
        }

        if (oContent && oContent.IsSelectionUse() && !oContent.IsSelectionEmpty()) {
            isCanCopy = true;
            isCanCut = true;
        }

        return {
            copy: isCanCopy,
            cut: isCanCut
        }
    };
    CPDFDoc.prototype.UpdateParagraphProps = function() {
        let oParaPr = this.GetCalculatedParaPr();

        if (oParaPr) {
            let isCanIncreaseInd = this.CanIncreaseParagraphLevel(true);
            let isCanDecreaseInd = this.CanIncreaseParagraphLevel(false);
            Asc.editor.sendEvent("asc_canIncreaseIndent", isCanIncreaseInd);
            Asc.editor.sendEvent("asc_canDecreaseIndent", isCanDecreaseInd);
            
            Asc.editor.UpdateParagraphProp(oParaPr);
            Asc.editor.sync_PrPropCallback(oParaPr);
        }
    };
    CPDFDoc.prototype.UpdateTextProps = function() {
        let oTextPr = this.GetCalculatedTextPr();
        if (oTextPr) {
            if (oTextPr.HighlightColor) {
                editor.sendEvent("asc_onMarkerFormatChanged", undefined, true);
            }
            else {
                editor.sendEvent("asc_onMarkerFormatChanged", undefined, false);
            }

            Asc.editor.UpdateTextPr(oTextPr);
        }
    };
    CPDFDoc.prototype.CanIncreaseParagraphLevel = function(bIncrease) {
        let oController = this.GetController();
        return oController.canIncreaseParagraphLevel(bIncrease);
    };

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	// Work with text
	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    CPDFDoc.prototype.MoveCursorLeft = function(isShiftKey, isCtrlKey) {
        let oDrDoc = this.GetDrawingDocument();

        let oForm       = this.activeForm;
        let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oDrawing    = this.activeDrawing;
        let oController = this.GetController();

        oDrDoc.UpdateTargetFromPaint = true;

        let oContent;
        if (oForm && oForm.IsInForm() && [AscPDF.FIELD_TYPES.text, AscPDF.FIELD_TYPES.combobox].includes(oForm.GetType())) {
            oForm.MoveCursorLeft(isShiftKey, isCtrlKey);
            oContent = oForm.GetDocContent();
        }
        else if (oFreeText && oFreeText.IsInTextBox()) {
            oFreeText.MoveCursorLeft(isShiftKey, isCtrlKey);
            oContent = oFreeText.GetDocContent();
        }
        else if (oDrawing && oDrawing.IsInTextBox()) {
            oController.cursorMoveLeft(isShiftKey, isCtrlKey);
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
        let oDrawing    = this.activeDrawing;
        let oController = this.GetController();

        oDrDoc.UpdateTargetFromPaint = true;

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
        else if (oDrawing && oDrawing.IsInTextBox()) {
            oController.cursorMoveUp(isShiftKey, isCtrlKey);
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
        let oDrawing    = this.activeDrawing;
        let oController = this.GetController();

        oDrDoc.UpdateTargetFromPaint = true;

        let oContent;
        if (oForm && oForm.IsInForm() && [AscPDF.FIELD_TYPES.text, AscPDF.FIELD_TYPES.combobox].includes(oForm.GetType())) {
            oForm.MoveCursorRight(isShiftKey, isCtrlKey);
            oContent = oForm.GetDocContent();
        }
        else if (oFreeText && oFreeText.IsInTextBox()) {
            oFreeText.MoveCursorRight(isShiftKey, isCtrlKey);
            oContent = oFreeText.GetDocContent();
        }
        else if (oDrawing && oDrawing.IsInTextBox()) {
            oController.cursorMoveRight(isShiftKey, isCtrlKey);
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

        let oForm           = this.activeForm;
        let oFreeText       = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oDrawing        = this.activeDrawing;
        let oController     = this.GetController();

        oDrDoc.UpdateTargetFromPaint = true;

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
        else if (oDrawing && oDrawing.IsInTextBox()) {
            oController.cursorMoveDown(isShiftKey, isCtrlKey);
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
        let oDrawing  = this.activeDrawing;

        let oContent;
        if (oForm && oForm.IsInForm() && [AscPDF.FIELD_TYPES.text, AscPDF.FIELD_TYPES.combobox].includes(oForm.GetType())) {
            oForm.SelectAllText();
            oContent = oForm.GetDocContent();
        }
        else if (oFreeText && oFreeText.IsInTextBox()) {
            oFreeText.SelectAllText();
            oContent = oFreeText.GetDocContent();
        }
        else if (oDrawing) {
            oDrawing.SelectAllText();
            oContent = oDrawing.GetDocContent();
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
        let oDrawing  = this.activeDrawing;

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
        else if (oDrawing) {
            oDrawing.SelectionSetStart(X, Y, e);
        }
        
        oDrDoc.UpdateTargetFromPaint = true;
        oDrDoc.TargetStart();
        oDrDoc.showTarget(true);
    };
    CPDFDoc.prototype.SelectionSetEnd = function(x, y, e) {
        let oDrDoc      = this.GetDrawingDocument();
        let oForm       = this.activeForm;
        let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oDrawing  = this.activeDrawing;

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
        else if (oDrawing) {
            oDrawing.SelectionSetEnd(X, Y, e);
            oContent = oDrawing.GetDocContent();
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
    CPDFDoc.prototype.GetCalculatedParaPr = function() {
        let oController = this.GetController();
        let oParaPr     = oController.getParagraphParaPr();

        if (oParaPr) {
            return oParaPr;
        }
    };
    CPDFDoc.prototype.GetCalculatedTextPr = function () {
        let oController = this.GetController();
        let oTextPr     = oController.getParagraphTextPr();

        if (oTextPr) {
            let oTheme = oController.getTheme();
            if (oTheme) {
                oTextPr.ReplaceThemeFonts(oTheme.themeElements.fontScheme);
            }
            return oTextPr;
        }
    };
    CPDFDoc.prototype.GetDirectTextPr = function() {
        let oController = this.GetController();
        return oController.getParagraphTextPr();
    };
    CPDFDoc.prototype.AddToParagraph = function(oParaItem) {
        this.CreateNewHistoryPoint();

        let oController = this.GetController();
        let oMathShape  = null;

        let oDrDoc      = this.GetDrawingDocument();
        let nCurPage    = this.Viewer.currentPage;
        let oPageInfo   = oDrDoc.m_arrPages[nCurPage];

        let nPageW  = oPageInfo.width_mm;
        let nPageH  = oPageInfo.height_mm;

        if (oParaItem.Type === para_Math) {
			if (!(oController.selection.textSelection || (oController.selection.groupSelection && oController.selection.groupSelection.selection.textSelection))) {
				oController.resetSelection();
                oController.resetTrackState();

				oMathShape = oController.createTextArt(0, false, null, "");

                let oXfrm   = oMathShape.getXfrm();
                let nPosX   = (nPageW - oXfrm.extX) / 2;
                let nPosY   = nPageH / 5;
                
                oXfrm.setOffX(nPosX);
                oXfrm.setOffY(nPosY);

				this.AddDrawing(oMathShape, nCurPage);
				oMathShape.select(oController, nCurPage);
                oMathShape.SetInTextBox(true);
                this.SetMouseDownObject(oMathShape);
				oController.selection.textSelection = oMathShape;
			}
		}

        oController.paragraphAdd(oParaItem, false);
        let oCurObject = this.GetActiveObject();
        oCurObject.SetNeedRecalc(true);
        if (oCurObject.IsAnnot() && oCurObject.IsFreeText()) {
            oCurObject.SetNeedUpdateRC(true);
        }
        
        this.History.SetSourceObjectsToPointPdf([oCurObject]);

        this.TurnOffHistory();
    };
    CPDFDoc.prototype.AddNewParagraph = function() {
        let oController     = this.GetController();
        let oObjectsByType	= oController.getSelectedObjectsByTypes(true);
        
        let aObjects = [];
        Object.values(oObjectsByType).forEach(function(arr) {
            arr.forEach(function(drawing) {
                aObjects.push(drawing);
            })
        });

        this.CreateNewHistoryPoint({objects: aObjects});
        oController.checkSelectedObjectsAndCallback(oController.addNewParagraph, [], false, AscDFH.historydescription_Presentation_AddNewParagraph);

        aObjects.forEach(function(drawing) {
            drawing.SetNeedRecalc(true);
        });

        this.TurnOffHistory();
    };
    CPDFDoc.prototype.GetSelectedText = function(bClearText, oPr) {
        let oForm       = this.activeForm;
        let oController = this.GetController();

        if (oForm) {
            let oContent = oForm.GetDocContent();
            if (oContent) {
                return oContent.GetSelectedText(bClearText, oPr);
            }
        }
        else {
            return oController.GetSelectedText(bClearText, oPr);
        }
    };
    
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	// Text/Para Pr
	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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

        let oFreeText   = this.mouseDownAnnot && this.mouseDownAnnot.IsFreeText() ? this.mouseDownAnnot : null;
        let oDrawing    = this.activeDrawing;

        if (oDrawing || oFreeText) {
            this.SetParagraphHighlight(this.Api.isMarkerFormat, r, g, b);
            return;
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
                oAnnot.SetStrokeColor([private_correctRGBColorComponent(r)/255, private_correctRGBColorComponent(g)/255, private_correctRGBColorComponent(b)/255]);
                oAnnot.SetOpacity(typeof(opacity) != "boolean" ? opacity / 100 : 1);
            }
        }

        if (this.bOffMarkerAfterUsing) {
            editor.sendEvent("asc_onMarkerFormatChanged", AscPDF.ANNOTATIONS_TYPES.Highlight, false);
            editor.SetMarkerFormat(AscPDF.ANNOTATIONS_TYPES.Highlight, false);
        }
    };
    CPDFDoc.prototype.SetParagraphHighlight = function(IsColor, r, g, b) {
        let oController     = this.GetController();
        let oObjectsByType	= oController.getSelectedObjectsByTypes(true);
        
        let aObjects = [];
        Object.values(oObjectsByType).forEach(function(arr) {
            arr.forEach(function(drawing) {
                aObjects.push(drawing);
            })
        });

        this.CreateNewHistoryPoint({objects: aObjects});
        
        let oDoc = this;
        let oTargetContent = oController.getTargetDocContent();
		if (!oTargetContent || oTargetContent.IsSelectionUse() && !oTargetContent.IsSelectionEmpty()) {
			oController.checkSelectedObjectsAndCallback(function () {
				if (false === IsColor) {
					oDoc.AddToParagraph(new ParaTextPr({HighlightColor: null}));
				} else {
					oDoc.AddToParagraph(new ParaTextPr({HighlightColor: AscFormat.CreateUniColorRGB(r, g, b)}));
				}
			}, [], false, AscDFH.historydescription_Document_SetTextHighlight);
		}

        aObjects.forEach(function(drawing) {
            drawing.SetNeedRecalc(true);
        });

        this.TurnOffHistory();
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
            oAnnot.SetStrokeColor([private_correctRGBColorComponent(r)/255, private_correctRGBColorComponent(g)/255, private_correctRGBColorComponent(b)/255]);
            oAnnot.SetOpacity(opacity / 100);
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

        aSelQuads = oFile.getSelectionQuads();
        if (aSelQuads.length == 0) return;

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
            oAnnot.SetStrokeColor([private_correctRGBColorComponent(r)/255, private_correctRGBColorComponent(g)/255, private_correctRGBColorComponent(b)/255]);
            oAnnot.SetOpacity(opacity / 100);
        }

        if (this.bOffMarkerAfterUsing) {
            editor.sendEvent("asc_onMarkerFormatChanged", AscPDF.ANNOTATIONS_TYPES.Strikeout, false);
            editor.SetMarkerFormat(AscPDF.ANNOTATIONS_TYPES.Strikeout, false);
        }
    };
    CPDFDoc.prototype.SetParagraphSpacing = function(oSpacing) {
        let oController     = this.GetController();
        let oObjectsByType	= oController.getSelectedObjectsByTypes(true);
        
        let aObjects = [];
        Object.values(oObjectsByType).forEach(function(arr) {
            arr.forEach(function(drawing) {
                aObjects.push(drawing);
            })
        });

        this.CreateNewHistoryPoint({objects: aObjects});
        oController.checkSelectedObjectsAndCallback(oController.setParagraphSpacing, [oSpacing], false, AscDFH.historydescription_Presentation_SetParagraphSpacing);

        aObjects.forEach(function(drawing) {
            drawing.SetNeedRecalc(true);
        });

        this.TurnOffHistory();
    };
    CPDFDoc.prototype.IncreaseDecreaseFontSize = function(bIncrease) {
        let oController     = this.GetController();
        let oObjectsByType	= oController.getSelectedObjectsByTypes(true);
        
        let aObjects = [];
        Object.values(oObjectsByType).forEach(function(arr) {
            arr.forEach(function(drawing) {
                aObjects.push(drawing);
            })
        });

        this.CreateNewHistoryPoint({objects: aObjects});
        oController.checkSelectedObjectsAndCallback(
            function () {
                oController.paragraphIncDecFontSize(bIncrease);
            }
            , [], false, AscDFH.historydescription_Presentation_ParagraphIncDecFontSize);

        aObjects.forEach(function(drawing) {
            drawing.SetNeedRecalc(true);
        });

        this.TurnOffHistory();
    };
    CPDFDoc.prototype.ChangeTextCase = function(nType) {
        let oController     = this.GetController();
        let oObjectsByType	= oController.getSelectedObjectsByTypes(true);
        
        let aObjects = [];
        Object.values(oObjectsByType).forEach(function(arr) {
            arr.forEach(function(drawing) {
                aObjects.push(drawing);
            })
        });

        this.CreateNewHistoryPoint({objects: aObjects});
        oController.changeTextCase(nCaseType);

        aObjects.forEach(function(drawing) {
            drawing.SetNeedRecalc(true);
        });

        this.TurnOffHistory();
    };
    CPDFDoc.prototype.SetParagraphAlign = function(Align) {
        let oController     = this.GetController();
        let oObjectsByType	= oController.getSelectedObjectsByTypes(true);
        
        let aObjects = [];
        Object.values(oObjectsByType).forEach(function(arr) {
            arr.forEach(function(drawing) {
                aObjects.push(drawing);
            })
        });

        this.CreateNewHistoryPoint({objects: aObjects});
        oController.checkSelectedObjectsAndCallback(oController.setParagraphAlign, [Align], false, AscDFH.historydescription_Presentation_SetParagraphAlign);

        aObjects.forEach(function(drawing) {
            drawing.SetNeedRecalc(true);
        });

        this.TurnOffHistory();
    };
    CPDFDoc.prototype.SetVerticalAlign = function(Align) {
        let oController     = this.GetController();
        let oObjectsByType	= oController.getSelectedObjectsByTypes(true);
        
        let aObjects = [];
        Object.values(oObjectsByType).forEach(function(arr) {
            arr.forEach(function(drawing) {
                aObjects.push(drawing);
            })
        });

        this.CreateNewHistoryPoint({objects: aObjects});
        oController.checkSelectedObjectsAndCallback(oController.applyDrawingProps, [{verticalTextAlign: Align}], false, AscDFH.historydescription_Presentation_SetVerticalAlign);

        aObjects.forEach(function(drawing) {
            drawing.SetNeedRecalc(true);
        });

        this.TurnOffHistory();
    };
    CPDFDoc.prototype.IncreaseDecreaseIndent = function(bIncrease) {
        let oController     = this.GetController();
        let oObjectsByType	= oController.getSelectedObjectsByTypes(true);
        
        let aObjects = [];
        Object.values(oObjectsByType).forEach(function(arr) {
            arr.forEach(function(drawing) {
                aObjects.push(drawing);
            })
        });

        this.CreateNewHistoryPoint({objects: aObjects});
        oController.checkSelectedObjectsAndCallback(oController.paragraphIncDecIndent, [bIncrease], false, AscDFH.historydescription_Presentation_ParagraphIncDecIndent);

        aObjects.forEach(function(drawing) {
            drawing.SetNeedRecalc(true);
        });

        this.TurnOffHistory();
    };
    CPDFDoc.prototype.ClearParagraphFormatting = function(isClearParaPr, isClearTextPr) {
        let oController     = this.GetController();
        let oObjectsByType	= oController.getSelectedObjectsByTypes(true);
        
        let aObjects = [];
        Object.values(oObjectsByType).forEach(function(arr) {
            arr.forEach(function(drawing) {
                aObjects.push(drawing);
            })
        });

        this.CreateNewHistoryPoint({objects: aObjects});
        oController.checkSelectedObjectsAndCallback(oController.paragraphClearFormatting, [isClearParaPr, isClearTextPr], false, AscDFH.historydescription_Presentation_ParagraphClearFormatting);

        aObjects.forEach(function(drawing) {
            drawing.SetNeedRecalc(true);
        });

        this.TurnOffHistory();
    };
        
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	// For drawings
	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    CPDFDoc.prototype.ConvertTextToShapes = function(nPage) {
        if (null == this.Viewer.drawingPages[nPage] || this.Viewer.drawingPages[nPage].isConvertedToShapes) {
            return;
        }

        this.Viewer.drawingPages[nPage].isConvertedToShapes = true;

        this.CreateNewHistoryPoint({textConvert: {page: nPage}});
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
            _t.AddDrawing(sp, nPage);
        });

        this.TurnOffHistory();
    };
    CPDFDoc.prototype.AddDrawing = function(oDrawing, nPage) {
        let oPagesInfo = this.Viewer.pagesInfo;
        if (!oPagesInfo.pages[nPage])
            return;

        this.drawings.push(oDrawing);
        if (oPagesInfo.pages[nPage].drawings == null) {
            oPagesInfo.pages[nPage].drawings = [];
        }
        oPagesInfo.pages[nPage].drawings.push(oDrawing);

        oDrawing.SetDocument(this);
        oDrawing.SetPage(nPage);

        if (oDrawing instanceof AscPDF.CPdfShape) {
            AscFormat.ExecuteNoHistory(function () {
                if (oDrawing.GetDocContent() == null) {
                    oDrawing.createTextBody();
                }
            }, this);
        }

        this.History.Add(new CChangesPDFDocumentAddItem(this, this.drawings.length - 1, [oDrawing]));

        oDrawing.AddToRedraw();
    };
    CPDFDoc.prototype.AddTextArt = function(nStyle, nPage) {
        let oPagesInfo = this.Viewer.pagesInfo;
        if (!oPagesInfo.pages[nPage])
            return;

        let oDrDoc      = this.GetDrawingDocument();
        let oPageInfo   = oDrDoc.m_arrPages[nPage];

        let oTextArt    = this.GetController().createTextArt(nStyle, false);
        let oXfrm       = oTextArt.getXfrm();

        let nExtX   = oXfrm.extX;
        let nExtY   = oXfrm.extY;
        let nPageW  = oPageInfo.width_mm;
        let nPageH  = oPageInfo.height_mm;

        oXfrm.setOffX((nPageW - nExtX) / 2);
        oXfrm.setOffY((nPageH / 2 - nExtY) / 2);

        this.drawings.push(oTextArt);
        if (oPagesInfo.pages[nPage].drawings == null) {
            oPagesInfo.pages[nPage].drawings = [];
        }
        oPagesInfo.pages[nPage].drawings.push(oTextArt);

        oTextArt.SetDocument(this);
        oTextArt.SetPage(nPage);

        this.History.Add(new CChangesPDFDocumentAddItem(this, this.drawings.length - 1, [oTextArt]));

        oTextArt.AddToRedraw();
    };
    CPDFDoc.prototype.AddSmartArt = function(nSmartArtType, oPlaceholder, nPage) {
        let oPagesInfo = this.Viewer.pagesInfo;
        if (!oPagesInfo.pages[nPage])
            return;

        let oDrDoc      = this.GetDrawingDocument();
        let oPageInfo   = oDrDoc.m_arrPages[nPage];

        let nPageW  = oPageInfo.width_mm;
        let nPageH  = oPageInfo.height_mm;

        let nExtX   = nPageW * 2 /3;
        let nExtY   = nPageH / 5;
        let nPosX   = (nPageW - nExtX) / 2;
        let nPosY   = nPageH / 5;

        let oController = this.GetController();
        let oSmartArt   = new AscPDF.CPdfSmartArt();

        oSmartArt.fillByPreset(nSmartArtType);
        oSmartArt.fitForSizes(nExtY, nExtX);
        oSmartArt.fitFontSize();
        oSmartArt.recalculateBounds();
        // oSmartArt.changeSize(nExtX / oSmartArt.extX, nExtY / oSmartArt.extY);
        let oXfrm = oSmartArt.getXfrm();
        oXfrm.setOffX(nPosX);
        oXfrm.setOffY(nPosY);
        oSmartArt.normalize();
        oSmartArt.setRecalculateInfo();
		
        let oPh;
        if (oPlaceholder) {
			this.Api.WordControl.m_bIsMouseLock = false;
			oPh = AscCommon.g_oTableId.Get_ById(oPlaceholder.id);
			if (oPh) {
				const nWidth = oPh.extX;
                const nHeight = oPh.extY;
                oSmartArt.fitForSizes(nHeight, nWidth);
                const nX = oPh.x + oPh.extX / 2 - oSmartArt.spPr.xfrm.extX / 2;
                const nY = oPh.y + oPlaceholder.extY / 2 - oSmartArt.spPr.xfrm.extY / 2;
                oSmartArt.spPr.xfrm.setOffX(nX);
                oSmartArt.spPr.xfrm.setOffY(nY);
			}
		}
		
		oSmartArt.checkDrawingBaseCoords();
		oSmartArt.fitFontSize();
		oController.checkChartTextSelection();
		oController.resetSelection();
        oController.resetTrackState();
		oSmartArt.select(oController, 0);
		this.SetMouseDownObject(oSmartArt);

        oController.clearTrackObjects();
        oController.clearPreTrackObjects();
        oController.changeCurrentState(new AscFormat.NullState(oController));
        oController.updateSelectionState();

        this.AddDrawing(oSmartArt, nPage);
        return oSmartArt;
    };
    CPDFDoc.prototype.AddChartByBinary = function(chartBinary, isFromInterface, oPlaceholder, nPage) {
        let oPagesInfo = this.Viewer.pagesInfo;
        if (!oPagesInfo.pages[nPage])
            return;

        let oThis       = this;
        let oDrDoc      = this.GetDrawingDocument();
        let oPageInfo   = oDrDoc.m_arrPages[nPage];
        let oController = this.GetController();

        let oChart = oController.getChartSpace2(chartBinary, null);

        let oXfrm   = oChart.getXfrm();
        let nPageW  = oPageInfo.width_mm;
        let nPageH  = oPageInfo.height_mm;
        let nPosX   = (nPageW - oXfrm.extX) / 2;
        let nPosY   = (nPageH - oXfrm.extY) / 2;

        if (oPlaceholder) {
            let oPh = AscCommon.g_oTableId.Get_ById(oPlaceholder.id);

            if (oPh) {
                nPosX = oPh.x;
                nPosY = oPh.y;
                oXfrm.setExtX(oPh.extX);
                oXfrm.setExtY(oPh.extY);
            }
            else {
                return;
            }
        }

        oXfrm.setOffX(nPosX);
        oXfrm.setOffY(nPosY);
        oController.resetSelection();
        oController.resetTrackState();
        oController.selectObject(oChart, 0);

        if (isFromInterface) {
            AscFonts.FontPickerByCharacter.checkText("", this, function () {
                oThis.AddDrawing(oChart, nPage);
            }, false, false, false);
        }
        else {
            this.AddDrawing(oChart, nPage);
        }
    };
    CPDFDoc.prototype.AddTable = function(nCol, nRow, sStyleId, nPage) {
        let oPagesInfo = this.Viewer.pagesInfo;
        if (!oPagesInfo.pages[nPage])
            return;

        let oGrFrame = this.private_Create_TableGraphicFrame(nCol, nRow, sStyleId || this.DefaultTableStyleId, undefined, undefined, undefined, undefined, nPage);
                
        this.AddDrawing(oGrFrame, nPage);
    };
    CPDFDoc.prototype.private_Create_TableGraphicFrame = function(Cols, Rows, StyleId, Width, Height, PosX, PosY, nPage, bInline) {
        let oDrDoc      = this.GetDrawingDocument();
        let oPageInfo   = oDrDoc.m_arrPages[nPage];

        let nPageW  = oPageInfo.width_mm;
        let nPageH  = oPageInfo.height_mm;

        let W;
        if (AscFormat.isRealNumber(Width)) {
            W = Width;
        } else {
            W = nPageW * 2 / 3;
        }
        let X, Y;
        if (AscFormat.isRealNumber(PosX) && AscFormat.isRealNumber(PosY)) {
            X = PosX;
            Y = PosY;
        } else {
            X = (nPageW - W) / 2;
            Y = nPageH / 5;
        }
        
        let Grid = [];
    
        for (let Index = 0; Index < Cols; Index++)
            Grid[Index] = W / Cols;
    
        let RowHeight;
        if (AscFormat.isRealNumber(Height)) {
            RowHeight = Height / Rows;
        }
    
        let Inline = false;
        if (AscFormat.isRealBool(bInline)) {
            Inline = bInline;
	    }

        let graphic_frame = new AscPDF.CPdfGraphicFrame();
        graphic_frame.setParent(this);
        graphic_frame.setSpPr(new AscFormat.CSpPr());
        graphic_frame.spPr.setParent(graphic_frame);
        graphic_frame.spPr.setXfrm(new AscFormat.CXfrm());
        graphic_frame.spPr.xfrm.setParent(graphic_frame.spPr);
        graphic_frame.spPr.xfrm.setOffX(X);
        graphic_frame.spPr.xfrm.setOffY(Y);
        graphic_frame.spPr.xfrm.setExtX(W);
        graphic_frame.spPr.xfrm.setExtY(7.478268771701388 * Rows);
        graphic_frame.setNvSpPr(new AscFormat.UniNvPr());
    
        let table = new CTable(this.GetDrawingDocument(), graphic_frame, Inline, Rows, Cols, Grid, true);
        table.Reset(Inline ? X : 0, Inline ? Y : 0, W, 100000, 0, 0, 1, 0);
        if (!Inline) {
            table.Set_PositionH(Asc.c_oAscHAnchor.Page, false, 0);
            table.Set_PositionV(Asc.c_oAscVAnchor.Page, false, 0);
        }
        table.SetTableLayout(tbllayout_Fixed);
        if (typeof StyleId === "string") {
            table.Set_TableStyle(StyleId);
        }
        table.Set_TableLook(new AscCommon.CTableLook(false, true, false, false, true, false));
        for (let i = 0; i < table.Content.length; ++i) {
            let Row = table.Content[i];
            if (AscFormat.isRealNumber(RowHeight)) {
                Row.Set_Height(RowHeight, Asc.linerule_AtLeast);
            }
        }
        graphic_frame.setGraphicObject(table);
        graphic_frame.setBDeleted(false);
        table.LogicDocument = this;
        return graphic_frame;
    };
    CPDFDoc.prototype.AddImages = function(arrImages) {
        let oViewer     = this.Viewer;
        let oDrDoc      = this.GetDrawingDocument();
        let nCurPage    = oViewer.currentPage;
        let oPageInfo   = oDrDoc.m_arrPages[nCurPage];
        
        for (let i = 0; i < arrImages.length; i++) {
            let _image  = arrImages[i];
            let nExtX   = Math.max(1, _image.Image.width * g_dKoef_pix_to_mm);
            let nExtY   = Math.max(1, _image.Image.height * g_dKoef_pix_to_mm);
            let nPageW  = oPageInfo.width_mm;
            let nPageH  = oPageInfo.height_mm;
            let nKoeff  = Math.min(1.0, 1.0 / Math.max(nExtX / nPageW, nExtY / nPageH));

            let nNewExtX = Math.max(5, nExtX * nKoeff); 
            let nNewExtY = Math.max(5, nExtY * nKoeff); 
            
            let nCenterX = (nPageW - nNewExtX) / 2;
            let nCenterY = (nPageH - nNewExtY) / 2;

            let oImage = new AscPDF.CPdfImage();

            AscFormat.fillImage(oImage, _image.src, nCenterX, nCenterY, nNewExtX, nNewExtY, _image.videoUrl, _image.audioUrl);
            this.AddDrawing(oImage, nCurPage);
        }
    };
    CPDFDoc.prototype.ShapeApply = function(shapeProps) {
        let oController     = this.GetController();
        let oObjectsByType	= oController.getSelectedObjectsByTypes(true);

        this.CreateNewHistoryPoint({objects: oObjectsByType.shapes});
        oController.applyDrawingProps(shapeProps);

        oObjectsByType.shapes.forEach(function(drawing) {
            drawing.SetNeedRecalc(true);
        });

        this.TurnOffHistory();
    };
    CPDFDoc.prototype.ChangeShapeType = function (sShapeType) {
        let oController     = this.GetController();
        let oObjectsByType	= oController.getSelectedObjectsByTypes(true);
        
        this.CreateNewHistoryPoint({objects: oObjectsByType.shapes});
        oController.checkSelectedObjectsAndCallback(oController.applyDrawingProps, [{type: sShapeType}], false, AscDFH.historydescription_Presentation_ChangeShapeType);

        oObjectsByType.shapes.forEach(function(drawing) {
            drawing.SetNeedRecalc(true);
        });

        this.TurnOffHistory();
    };
    CPDFDoc.prototype.SetImageProps = function(oPr) {
        let oController         = this.GetController();
        let oObjectsByType      = oController.getSelectedObjectsByTypes(true);
        let aAdditionalObjects  = null;

        this.CreateNewHistoryPoint({objects: oObjectsByType.images});
        
        if (AscFormat.isRealNumber(oPr.Width) && AscFormat.isRealNumber(oPr.Height)) {
            aAdditionalObjects = oController.getConnectorsForCheck2();
        }
        oController.checkSelectedObjectsAndCallback(oController.applyDrawingProps, [oPr], false, AscDFH.historydescription_Presentation_SetImageProps, aAdditionalObjects);
		oObjectsByType.images.forEach(function(drawing) {
            drawing.SetNeedRecalc(true);
        });

        this.TurnOffHistory();
    };
    CPDFDoc.prototype.FitImagesToPage = function () {
        let oController     = this.GetController();
        let oObjectsByType  = oController.getSelectedObjectsByTypes(true);

        this.CreateNewHistoryPoint({objects: oObjectsByType.images});

        oController.fitImagesToPage();
        oObjectsByType.images.forEach(function(drawing) {
            drawing.SetNeedRecalc(true);
        });
        
        this.TurnOffHistory();
        
    };
    CPDFDoc.prototype.AddTextWithPr = function(sText, oSettings) {
        let oController = this.GetController();
        oController.addTextWithPr(sText, oSettings);
    };
    CPDFDoc.prototype.GetChartObject = function(nType) {
        let oController = this.GetController();
        return oController.getChartObject(nType);
    };
    CPDFDoc.prototype.GetController = function() {
        return this.DrawingObjects;
    };

    //-----------------------------------------------------------------------------------
    // Функции для работы с таблицами
    //-----------------------------------------------------------------------------------

    CPDFDoc.prototype.GetTableForPreview = function () {
        return AscFormat.ExecuteNoHistory(function () {
            let _x_mar = 10;
            let _y_mar = 10;
            let _r_mar = 10;
            let _b_mar = 10;
            let _pageW = 297;
            let _pageH = 210;
            let W = (_pageW - _x_mar - _r_mar);
            let H = (_pageH - _y_mar - _b_mar);
            let oGrFrame = this.private_Create_TableGraphicFrame(5, 5, this.DefaultTableStyleId, W, H, _x_mar, _y_mar, this.Viewer.currentPage, true);
            oGrFrame.setBDeleted(true);
            oGrFrame.SetPage(this.Viewer.currentPage);
            return oGrFrame.graphicObject;
        }, this, []);
    };
    CPDFDoc.prototype.CheckTableForPreview = function (oTable) {};

    CPDFDoc.prototype.SetTableProps = function(oTablePr) {
        let oController = this.GetController();
        let oCurObject  = this.GetActiveObject();

        this.CreateNewHistoryPoint({objects: [oCurObject]});
        oCurObject.SetNeedRecalc(true);
        oController.setTableProps(oTablePr);
        this.TurnOffHistory();
    };

    CPDFDoc.prototype.ApplyTableFunction = function (Function, bBefore, bAll, Cols, Rows) {
        let oController = this.GetController();
        if(!oController)
            return null;
    
        let result = null;
    
        let args;
        if (AscFormat.isRealNumber(Rows) && AscFormat.isRealNumber(Cols)) {
            args = [Cols, Rows];
        } else {
            args = [bBefore];
        }
        let oTargetText = AscFormat.getTargetTextObject(oController);
        let oTable;
        if (oTargetText && oTargetText.getObjectType() === AscDFH.historyitem_type_GraphicFrame) {
            oTable = oTargetText.graphicObject;
        }
        else {
            let oByTypes = oController.getSelectedObjectsByTypes(true);
            if (oByTypes.tables.length === 1) {
                let oGrFrame = oByTypes.tables[0];
                oTable = oGrFrame.graphicObject;
                if (Function !== AscWord.CTable.prototype.DistributeTableCells) {
                    oGrFrame.Set_CurrentElement();
                    if (!(bAll === true)) {
                        if (bBefore) {
                            oTable.MoveCursorToStartPos();
                        } else {
                            oTable.MoveCursorToStartPos();
                        }
                    } else {
                        oTable.SelectAll();
                    }
                }
            }
        }
        if(oTable) {
            this.CreateNewHistoryPoint({objects: [oTable.Parent]});
            oTable.Parent.SetNeedRecalc(true);
            result = Function.apply(oTable, args);
            if (oTable.Content.length === 0) {
                this.RemoveDrawing(oTable.Parent);
                return result;
            }
            this.TurnOffHistory();
        }
        return result;
    };
    
    
    CPDFDoc.prototype.AddTableRow = function (bBefore) {
        this.ApplyTableFunction(CTable.prototype.AddTableRow, bBefore);
    };
    
    CPDFDoc.prototype.AddTableColumn = function (bBefore) {
        this.ApplyTableFunction(CTable.prototype.AddTableColumn, bBefore);
    };
    
    CPDFDoc.prototype.RemoveTableRow = function () {
        this.ApplyTableFunction(CTable.prototype.RemoveTableRow, undefined);
    };
    
    CPDFDoc.prototype.RemoveTableColumn = function () {
        this.ApplyTableFunction(CTable.prototype.RemoveTableColumn, true);
    };
    
    CPDFDoc.prototype.DistributeTableCells = function (isHorizontally) {
        return this.ApplyTableFunction(CTable.prototype.DistributeTableCells, isHorizontally);
    };
    
    CPDFDoc.prototype.MergeTableCells = function () {
        this.ApplyTableFunction(CTable.prototype.MergeTableCells, false, true);
    };
    
    CPDFDoc.prototype.SplitTableCells = function (Cols, Rows) {
        this.ApplyTableFunction(CTable.prototype.SplitTableCells, true, true, parseInt(Cols, 10), parseInt(Rows, 10));
    };
    
    CPDFDoc.prototype.SelectTable = function (Type) {
        const oController = this.GetController();
        if (oController) {
            let oByTypes = oController.getSelectedObjectsByTypes(true);
            if (oByTypes.tables.length === 1) {
                let oGrFrame = oByTypes.tables[0];
                oGrFrame.Set_CurrentElement();
                oGrFrame.graphicObject.SelectTable(Type);
                this.Viewer.onUpdateOverlay();
                return oGrFrame;
            }
        }
    };
    
    CPDFDoc.prototype.Table_CheckFunction = function (Function) {
        let oController = this.GetController();
        if (oController) {
            let oTextDrawing = AscFormat.getTargetTextObject(oController);
            if (oTextDrawing && oTextDrawing.getObjectType() === AscDFH.historyitem_type_GraphicFrame) {
                return Function.apply(oTextDrawing.graphicObject, []);
            }
        }
        return false;
    };
    
    CPDFDoc.prototype.CanMergeTableCells = function () {
        return this.Table_CheckFunction(CTable.prototype.CanMergeTableCells);
    };
    
    CPDFDoc.prototype.CanSplitTableCells = function () {
        return this.Table_CheckFunction(CTable.prototype.CanSplitTableCells);
    };
    
    CPDFDoc.prototype.CheckTableCoincidence = function (Table) {
        return false;
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
    CPDFDoc.prototype.InitDefaultTableStyles = function () {
        this.globalTableStyles = new CStyles(false);
    
        this.globalTableStyles.Id = AscCommon.g_oIdCounter.Get_NewId();
        AscCommon.g_oTableId.Add(this.globalTableStyles, this.globalTableStyles.Id);
        this.DefaultTableStyleId = AscFormat.CreatePresentationTableStyles(this.globalTableStyles, this.TableStylesIdMap);
    };

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	// Required extensions
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
    CPDFDoc.prototype.Set_TargetPos = function() {};
    CPDFDoc.prototype.GetSelectedDrawingObjectsCount = function() { 
        return 0;
    };
    CPDFDoc.prototype.isShapeChild = function() {};
    CPDFDoc.prototype.IsShowTableAdjustments = function() {
        return true;
    };
    CPDFDoc.prototype.Document_Is_SelectionLocked = function() {
        return false;
    };
    CPDFDoc.prototype.StartAction = function(){};
    CPDFDoc.prototype.Recalculate = function(){};
    CPDFDoc.prototype.FinalizeAction = function(){};
    
    CPDFDoc.prototype.GetDocPosType = function() {};
    CPDFDoc.prototype.GetSelectedContent = function() {};
    CPDFDoc.prototype.Is_ShowParagraphMarks = function() {};
    CPDFDoc.prototype.CheckTargetUpdate = function() {
        let oDrDoc = this.GetDrawingDocument();

        // Проверим можно ли вообще пересчитывать текущее положение.
        if (oDrDoc.UpdateTargetFromPaint === true) {
            if (true === oDrDoc.UpdateTargetCheck)
                this.NeedUpdateTarget = oDrDoc.UpdateTargetCheck;
            
            oDrDoc.UpdateTargetCheck = false;
        }

        if (!this.NeedUpdateTarget)
            return;

        let oActiveObj  = this.GetActiveObject();
        let oContent    = oActiveObj.GetDocContent();

        if (oActiveObj && oContent) {
            if (oActiveObj.IsNeedRecalc() == false) {
                // Обновляем курсор сначала, чтобы обновить текущую страницу
                oContent.RecalculateCurPos();
                this.NeedUpdateTarget = false;
            }
        }
    };
    CPDFDoc.prototype.SetWordSelection = function(){};
    
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
	CPDFDoc.prototype.Get_Theme = function() {
		return this.theme;
	};
	CPDFDoc.prototype.GetStyles = function() {
		return this.Get_Styles();
	};
    CPDFDoc.prototype.GetDefaultLanguage = function() {
        return this.GetStyles().Default.TextPr.Lang.Val;
    };
    CPDFDoc.prototype.GetTableStyles = function() {
        return this.globalTableStyles;
    };
    CPDFDoc.prototype.GetAllTableStyles = function() {
        return this.globalTableStyles.Style;
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
    CPDFDoc.prototype.GetPageWidthEMU = function(nPage) {
        nPage = nPage != undefined ? nPage : this.Viewer.currentPage;

        return this.Viewer.drawingPages[nPage].W * g_dKoef_pix_to_mm * g_dKoef_mm_to_emu;
    };
    CPDFDoc.prototype.GetPageHeightEMU = function(nPage) {
        nPage = nPage != undefined ? nPage : this.Viewer.currentPage;

        return this.Viewer.drawingPages[nPage].H * g_dKoef_pix_to_mm * g_dKoef_mm_to_emu;
    };
    CPDFDoc.prototype.GetPageWidthMM = function(nPage) {
        nPage = nPage != undefined ? nPage : this.Viewer.currentPage;

        return this.Viewer.drawingPages[nPage].W * g_dKoef_pix_to_mm;
    };
    CPDFDoc.prototype.GetPageHeightMM = function(nPage) {
        nPage = nPage != undefined ? nPage : this.Viewer.currentPage;

        return this.Viewer.drawingPages[nPage].H * g_dKoef_pix_to_mm;
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
	
		AscFonts.FontPickerByCharacter.extendFonts(aMap);

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
    CPDFDoc.prototype.Get_PageLimits = function(nPage) {
        let oDrDoc      = this.GetDrawingDocument();
        let oPageInfo   = oDrDoc.m_arrPages[nPage];

        return {
            X: 0,
            XLimit: Math.ceil(oPageInfo.width_mm),
            Y: 0,
            YLimit: Math.ceil(oPageInfo.height_mm),
        }
    };
    CPDFDoc.prototype.Get_PageFields = function(nPage) {
        return this.Get_PageLimits(nPage);
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

    function CreateAscAnnotPropFromObj(annot) {
        let oProps = new Asc.asc_CAnnotProperty();

        oProps.asc_putType(annot.GetType());
        
        let oFillColor  = annot.GetFillColor();
        let oFillRGB    = annot.GetRGBColor(oFillColor);
        let oFill       = AscFormat.CreateSolidFillRGBA(oFillRGB.r, oFillRGB.g, oFillRGB.b, 255);
        if (isRealObject(oFill)) {
            oProps.asc_putFill(AscFormat.CreateAscFill(oFill));
        }

        let oStrokeColor    = annot.GetStrokeColor();
        let oStrokeRGB      = annot.GetRGBColor(oStrokeColor);
        let oStrokeFill     = AscFormat.CreateSolidFillRGBA(oStrokeRGB.r, oStrokeRGB.g, oStrokeRGB.b, 255);
        if (isRealObject(oStrokeFill)) {
            oProps.asc_putStroke(AscFormat.CreateAscStroke(oStrokeFill, true));
        }

        if (annot.IsFreeText() && annot.IsInTextBox()) {
            oProps.asc_setCanEditText(true);
        }
        // obj.Position = new Asc.CPosition({X: shapeProp.x, Y: shapeProp.y});

        return oProps;
    }

    function private_correctRGBColorComponent(component) {
        if (typeof(component) != "number") {
            component = 0;
        }

        return component;
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
    window["AscPDF"].CreateAscAnnotPropFromObj = CreateAscAnnotPropFromObj;

})();

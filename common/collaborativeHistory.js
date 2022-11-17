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

"use strict";

(function (window)
{
	/**
	 * Класс работающий с общей историей в совместном редактировании
	 * @param {AscCommon.CCollaborativeEditingBase} coEditing
	 * @constructor
	 */
	function CCollaborativeHistory(coEditing)
	{
		this.CoEditing = coEditing;

		this.Changes   = []; // Список всех изменений
		this.OwnRanges = []; // Диапазоны собственных изменений

		this.SyncIndex = -1; // Позиция в массиве изменений, которые согласованы с сервером

		this.IsRestoreDeletedText = false;
		this.m_RewiewPoints = [];
		this.m_RewiewDelPoints = [];
		this.m_RewiewIndex = 0;
		this.m_RewiewIndexToDel = null;
	}

	CCollaborativeHistory.prototype.AddChange = function(change)
	{
		this.Changes.push(change);
	};
	CCollaborativeHistory.prototype.AddOwnChanges = function(ownChanges, deleteIndex)
	{
		// TODO: При удалении изменений не удаляются OwnRanges, которые могли ссылаться на эти изменения
		//       Надо проверить насколько это корректно

		if (null !== deleteIndex)
			this.Changes.length = this.SyncIndex + deleteIndex;
		else
			this.SyncIndex = this.Changes.length;

		// TODO: Пока мы делаем это как одну точку, которую надо откатить. Надо пробежаться по массиву и разбить его
		//       по отдельным действиям. В принципе, данная схема срабатывает в быстром совместном редактировании,
		//       так что как правило две точки не успевают попасть в одно сохранение.
		if (ownChanges.length > 0)
		{
			this.OwnRanges.push(new COwnRange(this.Changes.length, ownChanges.length));
			this.Changes = this.Changes.concat(ownChanges);
		}
	};
	CCollaborativeHistory.prototype.GetAllChanges = function()
	{
		return this.Changes;
	};
	CCollaborativeHistory.prototype.GetChangeCount = function()
	{
		return this.Changes.length;
	};
	CCollaborativeHistory.prototype.CanUndoGlobal = function()
	{
		return (this.Changes.length > 0);
	};
	CCollaborativeHistory.prototype.CanUndoOwn = function()
	{
		return (this.OwnRanges.length > 0)
	};
	/**
	 * Откатываем заданное количество действий
	 * @param {number} count
	 * @returns {[]} возвращаем массив откаченных действий
	 */
	CCollaborativeHistory.prototype.UndoGlobalChanges = function(count)
	{
		count = Math.min(count, this.Changes.length);

		if (!count)
			return [];

		let index = this.Changes.length - 1;
		let changeArray = [];
		while (index >= this.Changes.length - count)
		{
			let change = this.Changes[index--];
			if (!change)
				continue;

			if (change.IsContentChange())
			{
				let simpleChanges = change.ConvertToSimpleChanges();
				for (let simpleIndex = simpleChanges.length - 1; simpleIndex >= 0; --simpleIndex)
				{
					simpleChanges[simpleIndex].Undo();
					changeArray.push(simpleChanges[simpleIndex]);
				}
			}
			else
			{
				change.Undo();
				changeArray.push(change);
			}
		}

		this.Changes.length = this.Changes.length - count;
		return changeArray;
	};
	/**
	 * Отменяем все действия, попавшие в последнюю точку истории
	 * @returns {[]} возвращаем массив отмененных действий
	 */
	CCollaborativeHistory.prototype.UndoGlobalPoint = function()
	{
		let count = 0;
		for (let index = this.Changes.length - 1; index > 0; --index, ++count)
		{
			let change = this.Changes[index];
			if (!change)
				continue;

			if (change.IsDescriptionChange())
			{
				count++;
				break;
			}
		}

		return count ? this.UndoGlobalChanges(count) : [];
	};
	/**
	 * Отменяем собственные последние действия, прокатывая их через чужие
	 * @returns {[]} возвращаем массив новых действий
	 */
	CCollaborativeHistory.prototype.UndoOwnPoint = function()
	{
		// Формируем новую пачку действий, которые будут откатывать нужные нам действия
		let reverseChanges = this.GetReverseOwnChanges();
		if (reverseChanges.length <= 0)
			return [];

		for (let index = 0, count = reverseChanges.length; index < count; ++index)
		{
			let oClass = reverseChanges[index].GetClass();
			reverseChanges[index].Load();

			if (oClass && oClass.SetIsRecalculated && (!reverseChanges[index] || reverseChanges[index].IsNeedRecalculate()))
				oClass.SetIsRecalculated(false);

			this.AddChange(reverseChanges[index]);
		}

		// Создаем точку в истории. Делаем действия через обычные функции (с отключенным пересчетом), которые пишут в
		// историю. Сохраняем список изменений в новой точке, удаляем данную точку.

		let historyPoint = this.CreateLocalHistoryPointByReverseChanges(reverseChanges);
		let changesToSend = [], changesToRecalc = [];
		for (let index = 0, count = historyPoint.Items.length; index < count; ++index)
		{
			let historyItem   = historyPoint.Items[index];
			let historyChange = historyItem.Data;
			let historyClass  = historyItem.Class;

			if (!historyClass || !historyClass.Get_Id)
				continue;

			let data = AscCommon.CCollaborativeChanges.ToBase64(historyItem.Binary.Pos, historyItem.Binary.Len);
			changesToSend.push(data);

			changesToRecalc.push(historyChange);
		}
		AscCommon.History.Remove_LastPoint();
		this.CoEditing.Clear_DCChanges();

		editor.CoAuthoringApi.saveChanges(changesToSend, null, null, false, this.CoEditing.getCollaborativeEditing());

		return changesToRecalc;
	};
	CCollaborativeHistory.prototype.GetEmptyContentChanges = function()
	{
		let changes = [];
		for (let index = this.Changes.length - 1; index >= 0; --index)
		{
			let tempChange = this.Changes[index];

			if (tempChange.IsContentChange() && tempChange.GetItemsCount() <= 0)
				changes.push(tempChange);
		}
		return changes;
	};
	CCollaborativeHistory.prototype.InitNavigationRevisionHistory = function ()
	{
		if (this.Changes === 0)
			return;

		function ChangeIterator(context)
		{
			this.index = 0;
			this.changes = context.Changes;
			this.arrCurrentChanges = [];
			this.arrDelChanges = [];
			this.Init();
		}
		ChangeIterator.prototype.Init = function()
		{
			while(this.index < this.changes.length)
			{
				let arrDelChanges = [];
				let arrCurrentArray = [];
				let isSplit = false;

				const GetBlockIfChangeIsCChangesBase = function (context)
				{
					arrCurrentArray.push(context.changes[context.index]);
					context.index++;
					return context.changes[context.index].IsDescriptionChange();
				}

				let oCurrentBlock = (this.changes[this.index] instanceof AscDFH.CChangesBase && arrCurrentArray.length === 0)
					? GetBlockIfChangeIsCChangesBase(this)
					: this.changes[this.index].IsDescriptionChange()

				while (this.changes[this.index] && this.changes[this.index].IsDescriptionChange() === oCurrentBlock)
				{
					let curr_change = this.changes[this.index++];

					if (this.changes[this.index - 1] instanceof CChangesRunRemoveItem)
						arrDelChanges.push(curr_change);

					if (isSplit === true)
						break;

					arrCurrentArray.push(curr_change);
				}

				if (!isSplit)
				{
					this.arrCurrentChanges.push(arrCurrentArray.reverse());
					for (let i = 0; i < arrDelChanges.length; i++)
					{
						this.arrDelChanges.push(arrDelChanges[i]);
					}
				}
				isSplit = false;
			}
		}

		let oContent = new ChangeIterator(this);

		this.m_RewiewPoints = oContent.arrCurrentChanges.reverse();
		this.m_RewiewIndexToDel = this.Changes.length;
		this.GetDeleteTypeChanges();
	};
	CCollaborativeHistory.prototype.GetDeleteTypeChanges = function()
	{
		this.m_RewiewDelPoints = [];

		for (let i = this.Changes.length - this.m_RewiewIndex; i >= 0; i--)
		{
			if (this.Changes[i] instanceof CChangesRunRemoveItem)
				this.m_RewiewDelPoints.push(this.Changes[i]);
		}
	};
	CCollaborativeHistory.prototype.SetRestoreDeletedText = function(isDelete)
	{
		this.IsRestoreDeletedText = isDelete;
	};
	CCollaborativeHistory.prototype.GetIsRestoreDeletedText = function ()
	{
		return this.IsRestoreDeletedText;
	};
	CCollaborativeHistory.prototype.NavigationRevisionHistory = function (isUndo)
	{
		debugger
		if (isUndo)
			this.NavigationRevisionHistoryByCount(this.m_RewiewIndex - 1);
		else
			this.NavigationRevisionHistoryByCount(this.m_RewiewIndex + 1);

		if (this.IsRestoreDeletedText) {
			this.m_RewiewIndex = this.m_RewiewIndexToDel;
			this.NavigationRevisionHistoryByCount(this.Changes.length - 1);

			this.GetDeletedText();
		}
		editor.WordControl.m_oLogicDocument.RecalculateFromStart();

		// нужно сделать Undo для добавления и зачеркивания текста!
		// нужно удалить лишнее из Changes
		// нужно удалить последний Point
	};
	CCollaborativeHistory.prototype.NavigationRevisionHistoryByCount = function (intCount)
	{
		if (this.m_RewiewIndexToDel != null) {
			this.Changes.length = this.m_RewiewIndexToDel ? this.m_RewiewIndexToDel : this.Changes.length;
			this.m_RewiewPoints.shift();
		}

		this.GetDeleteTypeChanges();

		if (
			intCount === undefined 				||
			intCount === this.m_RewiewIndex 	||
			intCount < 0 						||
			intCount > this.m_RewiewPoints.length - 1
		)
			return;

		let arrChange = [];

		if (intCount < this.m_RewiewIndex)
		{
			for (let i = this.m_RewiewIndex; i > intCount; i--)
			{
				this.ReviewRedoBlock(this.m_RewiewPoints[i - 1], arrChange);
			}
			this.m_RewiewIndex = intCount;
		}
		else
		{
			for (let i = this.m_RewiewIndex; i < intCount; i++)
			{
				this.ReviewUndoBlock(this.m_RewiewPoints[i], arrChange);
			}
			this.m_RewiewIndex = intCount;
		}
	};
	CCollaborativeHistory.prototype.ReviewUndoBlock = function(arrBlock, changeArray)
	{
		for (let j = 0; j < arrBlock.length; j++) {
			let change = arrBlock[j];

			if (!change)
				continue;

			if (change.IsContentChange())
			{
				let simpleChanges = change.ConvertToSimpleChanges();
				for (let simpleIndex = 0; simpleIndex < simpleChanges.length; simpleIndex++)
				{
					simpleChanges[simpleIndex].Undo();
					//changeArray.push(simpleChanges[simpleIndex]);
				}
			}
			else
			{
				change.Undo();
				//changeArray.push(change);
			}
		}
	};
	CCollaborativeHistory.prototype.ReviewRedoBlock = function(arrBlock, changeArray)
	{
		for (let j = arrBlock.length - 1; j >= 0; j--)
		{
			let change = arrBlock[j];

			if (!change)
				continue;
			if (change.IsContentChange())
			{
				let simpleChanges = change.ConvertToSimpleChanges();
				for (let simpleIndex = 0; simpleIndex < simpleChanges.length; simpleIndex++)
				{
					simpleChanges[simpleIndex].Redo();
					//changeArray.push(simpleChanges[simpleIndex]);
				}
			}
			else
			{
				change.Redo();
				//changeArray.push(change);
			}
		}
	};
	CCollaborativeHistory.prototype.GetRealChange = function(index)
	{
		//let changes = index === undefined ? this.Changes : this.Changes.slice(0, index);
		function ChangeIterator()
		{
			this.index = 0;
			this.changes = changes;
			this.arrCurrentChanges = [];
			this.arrDelChanges = [];

			this.Init();
		}
		ChangeIterator.prototype.Init = function()
		{
			debugger
			if (changes.length < 1)
				return;

			while(this.index < this.changes.length)
			{
				let arrDelChanges = [];
				let arrCurrentArray = [];
				let isSplit = false;

				const Block = function (context) {
					arrCurrentArray.push(context.changes[context.index]);
					context.index++;
					return context.changes[context.index].IsDescriptionChange();
				}

				let oCurrentBlock = (this.changes[this.index] instanceof AscDFH.CChangesBase && arrCurrentArray.length === 0)
					? Block(this)
					: this.changes[this.index].IsDescriptionChange()

				while (this.changes[this.index] && this.changes[this.index].IsDescriptionChange() === oCurrentBlock)
				{
					let curr_change = this.changes[this.index++];

					if (this.changes[this.index - 1] instanceof CChangesRunRemoveItem)
					{
						arrDelChanges.push(curr_change);
					}

					if (isSplit === true)
						break;

					arrCurrentArray.push(curr_change)
				}

				if (!isSplit)
				{
					this.arrCurrentChanges.push(arrCurrentArray.reverse());
					for (let i = 0; i < arrDelChanges.length; i++)
					{
						this.arrDelChanges.push(arrDelChanges[i]);
					}
				}
				isSplit = false;
			}
		}

		let oContent = new ChangeIterator();
		this.m_RewiewPoints = oContent.arrCurrentChanges.reverse();
		this.m_RewiewDelPoints = oContent.arrDelChanges.reverse();
	};
	CCollaborativeHistory.prototype.PushDataDelPoints = function(arr)
	{
		this.m_RewiewPoints.unshift(arr);
	};
	CCollaborativeHistory.prototype.Review = function()
	{
		this.GetRealChange();
		this.GetDeletedText();
	};
	CCollaborativeHistory.prototype.UndoToChanges = function(arrBlock, changeArray)
	{
		for (let j = 0; j < arrBlock.length; j++) {
			let change = arrBlock[j];

			if (!change)
				continue;

			if (change.IsContentChange())
			{
				let simpleChanges = change.ConvertToSimpleChanges();
				for (let simpleIndex = 0; simpleIndex < simpleChanges.length; simpleIndex++)
				{
					changeArray.push(simpleChanges[simpleIndex].CreateReverseChange());
					changeArray[changeArray.length - 1].Redo();
				}
			}
			else
			{
				changeArray.push(change.CreateReverseChange());
				changeArray[changeArray.length - 1].Redo();
			}
		}
	};
	CCollaborativeHistory.prototype.GetDeletedText = function()
	{
		let changeArray = [];
		let arrContentDel = [];

		function one(obj) {

			for (let i = 0; i < arrContentDel.length; i++) {
				arrContentDel[i][0] += 1;
				arrContentDel[i][1] += 1;

				if (obj[2] === arrContentDel[i][2])
				{
					let count = obj[1] - obj[0];
					arrContentDel[i][0] += count;
					arrContentDel[i][1] += count;
				}
			}
			arrContentDel.push(obj);
			isPushed = true;
		}

		let pointIndex = AscCommon.History.CreateNewPointToCollectChanges(AscDFH.historydescription_Collaborative_DeletedTextRecovery);

		let intStartPos = 0;
		let intEndPos = 0;
		let strCurrentId = null;
		let isPushed = true;

		for (let i = 0; i < this.m_RewiewDelPoints.length; i++)
		{
			let oCurrentChange = this.m_RewiewDelPoints[i];

			if (strCurrentId !== oCurrentChange.Class.Id || isPushed)
			{
				strCurrentId = oCurrentChange.Class.Id;
				intEndPos = intStartPos = oCurrentChange.PosArray[0];
				isPushed = false;
			}
			else if (intStartPos < oCurrentChange.PosArray[0])
			{
				intEndPos = oCurrentChange.PosArray[0];
				isPushed = false;
			}

			if (this.m_RewiewDelPoints.length - 1 === i || (this.m_RewiewDelPoints[i + 1] && (this.m_RewiewDelPoints[i + 1].Class.Id !== oCurrentChange.Class.Id) || (this.m_RewiewDelPoints[i + 1].PosArray[0] <  intEndPos)))
			{
				one([intStartPos, intEndPos, oCurrentChange.Class]);
			}

			this.UndoToChanges([oCurrentChange], changeArray);
		}

		//теперь это нужно переделать в изменение
		for (let i = 0; i < arrContentDel.length; i++)
		{
			let CurrentBlock = arrContentDel[i];
			let firstElement, secondElement;

			if (CurrentBlock[0] !== 0)
			{
				firstElement = CurrentBlock[2].Split_Run(CurrentBlock[0]);
				let pos = CurrentBlock[2].Get_Position();
				CurrentBlock[2].Parent.Add_ToContent(pos + 1, firstElement);
			}

			if (firstElement)
			{
				secondElement = firstElement.Split_Run(CurrentBlock[1] - CurrentBlock[0] + 1);
				firstElement.SetStrikeout(true);
				let pos = firstElement.Get_Position();
				firstElement.Parent.Add_ToContent(pos + 2, secondElement);
			}
			else
			{
				firstElement = CurrentBlock[2].Split_Run(CurrentBlock[1]);
				CurrentBlock[2].SetStrikeout(true);
				let pos = CurrentBlock[2].Get_Position();
				CurrentBlock[2].Parent.Add_ToContent(pos + 1, firstElement);
			}
		}
		AscCommon.History.Update_PointInfoItem(pointIndex, pointIndex, pointIndex, 0, null);

		let oHistoryPoint = AscCommon.History.Points[pointIndex];
		for (let nIndex = 0, nCount = oHistoryPoint.Items.length; nIndex < nCount; ++nIndex)
		{
			changeArray.push(oHistoryPoint.Items[nIndex].Data);
		}

		AscCommon.History.Remove_LastPoint();
		this.CoEditing.Clear_DCChanges();

		this.Changes = this.Changes.concat(changeArray);
		this.PushDataDelPoints(changeArray.reverse());

		this.IsRestoreDeletedText = true;
		editor.WordControl.m_oLogicDocument.RecalculateFromStart();
	};

	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	// Private area
	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	CCollaborativeHistory.prototype.GetReverseOwnChanges = function()
	{
		// На первом шаге мы заданнуюю пачку изменений коммутируем с последними измениями. Смотрим на то какой набор
		// изменений у нас получается.
		// Объектная модель у нас простая: класс, в котором возможно есть массив элементов(тоже классов), у которого воможно
		// есть набор свойств. Поэтому у нас ровно 2 типа изменений: изменения внутри массива элементов, либо изменения
		// свойств. Изменения этих двух типов коммутируют между собой, изменения разных классов тоже коммутируют.

		if (this.OwnRanges.length <= 0)
			return [];

		let range     = this.OwnRanges[this.OwnRanges.length - 1];
		let nPosition = range.Position;
		let nCount    = range.Length;

		let arrChanges = [];
		for (let nIndex = nCount - 1; nIndex >= 0; --nIndex)
		{
			let oChange = this.Changes[nPosition + nIndex];
			if (!oChange)
				continue;

			let oClass = oChange.GetClass();
			if (oChange.IsContentChange())
			{
				let _oChange = oChange.Copy();

				if (this.CommuteContentChange(_oChange, nPosition + nCount))
					arrChanges.push(_oChange);

				oChange.SetReverted(true);
			}
			else
			{
				let _oChange = oChange; // TODO: Тут надо бы сделать копирование

				if (this.CommutePropertyChange(oClass, _oChange, nPosition + nCount))
					arrChanges.push(_oChange);
			}
		}

		this.OwnRanges.length = this.OwnRanges.length - 1;

		let arrReverseChanges = [];
		for (let nIndex = 0, nCount = arrChanges.length; nIndex < nCount; ++nIndex)
		{
			let oReverseChange = arrChanges[nIndex].CreateReverseChange();
			if (oReverseChange)
			{
				arrReverseChanges.push(oReverseChange);
				oReverseChange.SetReverted(true);
			}
		}

		return arrReverseChanges;
	};
	CCollaborativeHistory.prototype.CommuteContentChange = function(oChange, nStartPosition)
	{
		var arrActions          = oChange.ConvertToSimpleActions();
		var arrCommutateActions = [];

		for (var nActionIndex = arrActions.length - 1; nActionIndex >= 0; --nActionIndex)
		{
			var oAction = arrActions[nActionIndex];
			var oResult = oAction;

			for (var nIndex = nStartPosition, nOverallCount = this.Changes.length; nIndex < nOverallCount; ++nIndex)
			{
				var oTempChange = this.Changes[nIndex];
				if (!oTempChange)
					continue;

				if (oChange.IsRelated(oTempChange) &&  true !== oTempChange.IsReverted())
				{
					var arrOtherActions = oTempChange.ConvertToSimpleActions();
					for (var nIndex2 = 0, nOtherActionsCount2 = arrOtherActions.length; nIndex2 < nOtherActionsCount2; ++nIndex2)
					{
						var oOtherAction = arrOtherActions[nIndex2];

						if (false === this.CommuteContentChangeActions(oAction, oOtherAction))
						{
							arrOtherActions.splice(nIndex2, 1);
							oResult = null;
							break;
						}
					}

					oTempChange.ConvertFromSimpleActions(arrOtherActions);
				}

				if (!oResult)
					break;

			}

			if (null !== oResult)
				arrCommutateActions.push(oResult);
		}

		if (arrCommutateActions.length > 0)
			oChange.ConvertFromSimpleActions(arrCommutateActions);
		else
			return false;

		return true;
	};
	CCollaborativeHistory.prototype.CommuteContentChangeActions = function(oActionL, oActionR)
	{
		if (oActionL.Add)
		{
			if (oActionR.Add)
			{
				if (oActionL.Pos >= oActionR.Pos)
					oActionL.Pos++;
				else
					oActionR.Pos--;
			}
			else
			{
				if (oActionL.Pos > oActionR.Pos)
					oActionL.Pos--;
				else if (oActionL.Pos === oActionR.Pos)
					return false;
				else
					oActionR.Pos--;
			}
		}
		else
		{
			if (oActionR.Add)
			{
				if (oActionL.Pos >= oActionR.Pos)
					oActionL.Pos++;
				else
					oActionR.Pos++;
			}
			else
			{
				if (oActionL.Pos > oActionR.Pos)
					oActionL.Pos--;
				else
					oActionR.Pos++;
			}
		}

		return true;
	};
	CCollaborativeHistory.prototype.CommutePropertyChange = function(oClass, oChange, nStartPosition)
	{
		// В GoogleDocs если 2 пользователя исправляют одно и тоже свойство у одного и того же класса, тогда Undo работает
		// у обоих. Например, первый выставляет параграф по центру (изначально по левому), второй после этого по правому
		// краю. Тогда на Undo первого пользователя возвращает параграф по левому краю, а у второго по центру, неважно в
		// какой последовательности они вызывают Undo.
		// Далем как у них: т.е. изменения свойств мы всегда откатываем, даже если данное свойсво менялось в последующих
		// изменениях.

		// Здесь вариант: свойство не откатываем, если оно менялось в одном из последующих действий. (для работы этого
		// варианта нужно реализовать функцию IsRelated у всех изменений).

		// // Значит это изменение свойства. Пробегаемся по всем следующим изменениям и смотрим, менялось ли такое
		// // свойство у данного класса, если да, тогда данное изменение невозможно скоммутировать.
		// for (var nIndex = nStartPosition, nOverallCount = this.Changes.length; nIndex < nOverallCount; ++nIndex)
		// {
		// 	var oTempChange = this.Changes[nIndex];
		// 	if (!oTempChange || !oTempChange.IsChangesClass || !oTempChangeIsChangesClass())
		// 		continue;
		//
		// 	if (oChange.IsRelated(oTempChange))
		// 		return false;
		// }

		if(oChange.CheckCorrect && !oChange.CheckCorrect())
		{
			return false;
		}
		return true;
	};
	CCollaborativeHistory.prototype.CreateLocalHistoryPointByReverseChanges = function(reverseChanges)
	{
		let localHistory = AscCommon.History;

		let pointIndex = localHistory.CreateNewPointToCollectChanges(AscDFH.historydescription_Collaborative_Undo);

		for (let index = 0, count = reverseChanges.length; index < count; ++index)
		{
			let change = reverseChanges[index];
			localHistory.Add(change);
		}

		this.CorrectReveredChanges(reverseChanges);

		localHistory.Update_PointInfoItem(pointIndex, pointIndex, pointIndex, 0, null);

		return localHistory.Points[pointIndex];
	};
	CCollaborativeHistory.prototype.CorrectReveredChanges = function(arrReverseChanges)
	{
		let oLogicDocument = this.CoEditing.GetLogicDocument();

		// Может так случиться, что в каких-то классах DocumentContent удалились все элементы, либо
		// в классе Paragraph удалился знак конца параграфа. Нам необходимо проверить все классы на корректность, и если
		// нужно, добавить дополнительные изменения.

		var mapDrawings         = {};
		var mapDocumentContents = {};
		var mapParagraphs       = {};
		var mapRuns             = {};
		var mapTables           = {};
		var mapGrObjects        = {};
		var mapSlides           = {};
		var mapLayouts          = {};
		var mapTimings          = {};
		var bChangedLayout      = false;
		var bAddSlides          = false;
		var mapAddedSlides      = {};
		var mapCommentsToDelete = {};

		for (let nIndex = 0, nCount = arrReverseChanges.length; nIndex < nCount; ++nIndex)
		{
			var oChange = arrReverseChanges[nIndex];
			var oClass  = oChange.GetClass();

			if (oClass instanceof AscCommonWord.CDocument || oClass instanceof AscCommonWord.CDocumentContent)
			{
				mapDocumentContents[oClass.Get_Id()] = oClass;
			}
			else if (oClass instanceof AscCommonWord.Paragraph)
			{
				mapParagraphs[oClass.Get_Id()] = oClass;
			}
			else if (oClass.IsParagraphContentElement && true === oClass.IsParagraphContentElement() && true === oChange.IsContentChange() && oClass.GetParagraph())
			{
				mapParagraphs[oClass.GetParagraph().Get_Id()] = oClass.GetParagraph();
				if (oClass instanceof AscCommonWord.ParaRun)
					mapRuns[oClass.Get_Id()] = oClass;
			}
			else if (oClass && oClass.parent && oClass.parent instanceof AscCommonWord.ParaDrawing)
			{
				mapDrawings[oClass.parent.Get_Id()] = oClass.parent;
			}
			else if (oClass instanceof AscCommonWord.ParaDrawing)
			{
				mapDrawings[oClass.Get_Id()] = oClass;
			}
			else if (oClass instanceof AscCommonWord.ParaRun)
			{
				mapRuns[oClass.Get_Id()] = oClass;
			}
			else if (oClass instanceof AscCommonWord.CTable)
			{
				mapTables[oClass.Get_Id()] = oClass;
			}
			else if (oClass instanceof AscFormat.CShape
				|| oClass instanceof AscFormat.CImageShape
				|| oClass instanceof AscFormat.CChartSpace
				|| oClass instanceof AscFormat.CGroupShape
				|| oClass instanceof AscFormat.CGraphicFrame)
			{
				mapGrObjects[oClass.Get_Id()] = oClass;
				let oParent                   = oClass.parent;
				if (oParent && oParent.timing)
				{
					mapTimings[oParent.timing.Get_Id()] = oParent.timing;
				}
			}
			else if (typeof AscCommonSlide !== "undefined" && AscCommonSlide.Slide && oClass instanceof AscCommonSlide.Slide)
			{
				mapSlides[oClass.Get_Id()] = oClass;
				if (oClass.timing)
				{
					mapTimings[oClass.timing.Get_Id()] = oClass.timing;
				}
			}
			else if (typeof AscCommonSlide !== "undefined" && AscCommonSlide.SlideLayout && oClass instanceof AscCommonSlide.SlideLayout)
			{
				mapLayouts[oClass.Get_Id()] = oClass;
				if (oClass.timing)
				{
					mapTimings[oClass.timing.Get_Id()] = oClass.timing;
				}
				bChangedLayout = true;
			}
			else if (typeof AscCommonSlide !== "undefined" && AscCommonSlide.CPresentation && oClass instanceof AscCommonSlide.CPresentation)
			{
				if (oChange.Type === AscDFH.historyitem_Presentation_RemoveSlide || oChange.Type === AscDFH.historyitem_Presentation_AddSlide)
				{
					bAddSlides = true;
					for (var i = 0; i < oChange.Items.length; ++i)
					{
						mapAddedSlides[oChange.Items[i].Get_Id()] = oChange.Items[i];
					}
				}
			}
			else if (AscDFH.historyitem_ParaComment_CommentId === oChange.Type)
			{
				mapCommentsToDelete[oChange.New] = oClass;
			}
			else if (oClass.isAnimObject)
			{
				let oTiming = oClass.getTiming();
				if (oTiming)
				{
					mapTimings[oTiming.Get_Id()] = oTiming;
				}
			}
		}


		if (bAddSlides)
		{
			for (var i = oLogicDocument.Slides.length - 1; i > -1; --i)
			{
				if (mapAddedSlides[oLogicDocument.Slides[i].Get_Id()] && !oLogicDocument.Slides[i].Layout)
				{
					oLogicDocument.removeSlide(i);
				}
			}
		}

		for (var sId in mapSlides)
		{
			if (mapSlides.hasOwnProperty(sId))
			{
				mapSlides[sId].correctContent();
			}
		}

		if (bChangedLayout)
		{
			for (var i = oLogicDocument.Slides.length - 1; i > -1; --i)
			{
				var Layout = oLogicDocument.Slides[i].Layout;
				if (!Layout || mapLayouts[Layout.Get_Id()])
				{
					if (!oLogicDocument.Slides[i].CheckLayout())
					{
						oLogicDocument.removeSlide(i);
					}
				}
			}
		}


		for (var sId in mapGrObjects)
		{
			var oShape = mapGrObjects[sId];
			if (!oShape.checkCorrect())
			{
				oShape.setBDeleted(true);
				if (oShape.group)
				{
					oShape.group.removeFromSpTree(oShape.Get_Id());
				}
				else if (AscFormat.Slide && (oShape.parent instanceof AscFormat.Slide))
				{
					oShape.parent.removeFromSpTreeById(oShape.Get_Id());
				}
				else if (AscCommonWord.ParaDrawing && (oShape.parent instanceof AscCommonWord.ParaDrawing))
				{
					mapDrawings[oShape.parent.Get_Id()] = oShape.parent;
				}
			}
			else
			{
				if (oShape.resetGroups)
				{
					oShape.resetGroups();
				}
			}
		}
		var oDrawing;
		for (var sId in mapDrawings)
		{
			if (mapDrawings.hasOwnProperty(sId))
			{
				oDrawing = mapDrawings[sId];
				if (!oDrawing.CheckCorrect())
				{
					var oParentParagraph = oDrawing.Get_ParentParagraph();
					oDrawing.PreDelete();
					oDrawing.Remove_FromDocument(false);
					if (oParentParagraph)
					{
						mapParagraphs[oParentParagraph.Get_Id()] = oParentParagraph;
					}
				}
			}
		}

		for (var sId in mapRuns)
		{
			if (mapRuns.hasOwnProperty(sId))
			{
				var oRun = mapRuns[sId];
				for (var nIndex = oRun.Content.length - 1; nIndex > -1; --nIndex)
				{
					if (oRun.Content[nIndex] instanceof AscCommonWord.ParaDrawing)
					{
						if (!oRun.Content[nIndex].CheckCorrect())
						{
							oRun.Remove_FromContent(nIndex, 1, false);
							if (oRun.Paragraph)
							{
								mapParagraphs[oRun.Paragraph.Get_Id()] = oRun.Paragraph;
							}
						}
					}
				}
			}
		}

		for (var sId in mapTables)
		{
			var oTable = mapTables[sId];
			for (var nCurRow = oTable.Content.length - 1; nCurRow >= 0; --nCurRow)
			{
				var oRow = oTable.Get_Row(nCurRow);
				if (oRow.Get_CellsCount() <= 0)
					oTable.private_RemoveRow(nCurRow);
			}

			if (oTable.Parent instanceof AscCommonWord.CDocument || oTable.Parent instanceof AscCommonWord.CDocumentContent)
				mapDocumentContents[oTable.Parent.Get_Id()] = oTable.Parent;
		}

		for (var sId in mapDocumentContents)
		{
			var oDocumentContent = mapDocumentContents[sId];
			var nContentLen      = oDocumentContent.Content.length;
			for (var nIndex = nContentLen - 1; nIndex >= 0; --nIndex)
			{
				var oElement = oDocumentContent.Content[nIndex];
				if ((AscCommonWord.type_Paragraph === oElement.GetType() || AscCommonWord.type_Table === oElement.GetType()) && oElement.Content.length <= 0)
				{
					oDocumentContent.Remove_FromContent(nIndex, 1);
				}
			}

			nContentLen = oDocumentContent.Content.length;
			if (nContentLen <= 0 || AscCommonWord.type_Paragraph !== oDocumentContent.Content[nContentLen - 1].GetType())
			{
				var oNewParagraph = new AscCommonWord.Paragraph(oLogicDocument.Get_DrawingDocument(), oDocumentContent, 0, 0, 0, 0, 0, false);
				oDocumentContent.Add_ToContent(nContentLen, oNewParagraph);
			}
		}

		for (var sId in mapParagraphs)
		{
			var oParagraph = mapParagraphs[sId];
			oParagraph.CheckParaEnd();
			oParagraph.Correct_Content(null, null, true);
		}

		for (var sId in mapTimings)
		{
			if (mapTimings.hasOwnProperty(sId))
			{
				let oTiming = mapTimings[sId];
				oTiming.checkCorrect();
			}
		}
		if (oLogicDocument && oLogicDocument.IsDocumentEditor())
		{
			for (var sCommentId in mapCommentsToDelete)
			{
				oLogicDocument.RemoveComment(sCommentId, false, false);
			}
		}
	};
	//------------------------------------------------------------------------------------------------------------------
	/**
	 * Отрезок собственных изменений в общем массиве
	 * @param position
	 * @param length
	 * @constructor
	 */
	function COwnRange(position, length)
	{
		this.Position = position;
		this.Length   = length;
	}

	//--------------------------------------------------------export----------------------------------------------------
	window['AscCommon'] = window['AscCommon'] || {};
	window['AscCommon'].CCollaborativeHistory = CCollaborativeHistory;

})(window);
